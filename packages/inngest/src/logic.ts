/**
 * packages/inngest/src/logic.ts — the business logic of every autonomous job, extracted as plain,
 * dependency-injected functions so they are DB-testable with mocked AI/Resend (no Inngest Cloud needed).
 * The durable Inngest functions in functions.ts are thin step.run wrappers over these.
 *
 * Contract (CLAUDE.md §2 — the Prime Directive):
 *   - Each function receives an OPEN, org-scoped Drizzle transaction (`tx`). Production wraps the call in
 *     withOrg(orgId, …); tests open their own rolled-back transaction. The logic NEVER opens its own tx,
 *     so a test can roll everything back and nothing autonomous ever commits to the shared DB.
 *   - triage / rankQuotes / monitors ANALYZE and RECOMMEND only — they never send email and never advance
 *     a solicitation past TRIAGE_COMPLETE / PRICING_PENDING toward an outbound or committed state.
 *   - The ONLY function that sends email is sendOutreach, and it REFUSES to send unless the campaign is
 *     already APPROVED by a recorded human (belt to the durable waitForEvent gate's suspenders; the DB
 *     CHECKs are a third layer). No model score can satisfy that condition.
 *   - Every autonomous write and every approval appends an audit_log row (actorType SYSTEM / ADMIN).
 */
import type { Engine } from "@hermes/ai";
import { buildCostModel, FailClosedError, MODELS } from "@hermes/ai";
// Operators come from @hermes/db (the package that owns the drizzle-orm instance) so their SQL<> types
// match the table objects — never import these from "drizzle-orm" directly (see packages/db/src/orm.ts).
import {
  and,
  arFollowups,
  awardIntelligence,
  desc,
  eq,
  gte,
  hasUnconfirmedCounselThresholds,
  inArray,
  isNull,
  lte,
  outreachCampaigns,
  orgs,
  parseDirectives,
  proposals,
  solicitations,
  sql,
  users,
  vendorProspects,
  vendorQuoteLineItems,
  vendorQuotes,
  type Tx,
} from "@hermes/db";
import { hashToken, mintToken } from "@hermes/core";
import type { BriefItem, MorningBriefInput, OutreachEmailInput } from "@hermes/emails";

import { writeAudit, type FetchResult } from "./safety.js";

/* ----------------------------------- constants ----------------------------------- */

const TOKEN_TTL_DAYS = 14;
const TOKEN_TTL_MS = TOKEN_TTL_DAYS * 86_400_000;
const DEADLINE_HORIZON_MS = 72 * 60 * 60 * 1000; // surface solicitations due within 72h
const DEFAULT_NAICS = ["541511", "541512", "541519"] as const;
const NAICS_RE = /^[0-9]{6}$/;

/** Solicitation statuses that are still "live" for deadline/brief surfacing (not terminal). */
const LIVE_STATUSES = [
  "TRIAGE_COMPLETE",
  "READY_FOR_SOURCING",
  "AWAITING_APPROVAL",
  "SOURCING_IN_PROGRESS",
  "PRICING_PENDING",
  "PROPOSAL_DRAFT",
] as const;

/* ----------------------------------- deps + types -------------------------------- */

/** Injected collaborators. Production wires the live engine / Resend / SSRF-guarded fetch; tests mock. */
export interface LogicDeps {
  ai: Pick<Engine, "triageSolicitation" | "scoreProspect" | "draftSOW" | "evaluateQuotes" | "draftBid">;
  sendOutreachEmail: (input: OutreachEmailInput) => Promise<{ id?: string }>;
  sendBriefEmail: (input: MorningBriefInput) => Promise<{ id?: string }>;
  fetchDoc: (
    url: string,
    opts?: {
      maxBytes?: number;
      allowedTypes?: string[];
      method?: "GET" | "POST";
      body?: string;
      headers?: Record<string, string>;
    },
  ) => Promise<FetchResult>;
}

export interface IngestedSolicitation {
  id: string;
  noticeId: string;
}

export interface DraftedOutreach {
  outreachId: string;
  prospectId: string;
}

/* ----------------------------------- helpers ------------------------------------- */

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://burgergov.com").replace(/\/+$/, "");
}

/** Map the AI's coarse boolean fit + numeric feasibility onto the DB's graded zero_float_fit enum. */
function mapZeroFloatFit(fits: boolean, feasibility: number): "STRONG" | "MODERATE" | "WEAK" | "NONE" {
  if (!fits) return "NONE";
  if (feasibility >= 8) return "STRONG";
  if (feasibility >= 5) return "MODERATE";
  return "WEAK";
}

/** The AI may return UNKNOWN; the DB enum has no UNKNOWN, so map it to null (leave unset). */
function mapContractType(t: string): "FFP" | "TM" | "FFP_MILESTONE" | null {
  return t === "FFP" || t === "TM" || t === "FFP_MILESTONE" ? t : null;
}

/**
 * Map the DB's 7-value set_aside_type onto the compliance engine's 3-value SetAside. The firm holds no
 * socio-economic certifications (CLAUDE.md §6.7), so 8(a)/HUBZONE/SDVOSB/WOSB/OTHER all collapse to
 * OTHER_RESTRICTED — with orgSocioEconomicCerts=[] that is a CORRECT eligibility BLOCK, never a false one.
 */
function mapSetAside(t: string): "NONE" | "TOTAL_SMALL_BUSINESS" | "OTHER_RESTRICTED" {
  if (t === "NONE") return "NONE";
  if (t === "TOTAL_SMALL_BUSINESS") return "TOTAL_SMALL_BUSINESS";
  return "OTHER_RESTRICTED";
}

const num = (v: unknown): number => Number(v ?? 0);
const money2 = (n: number): string => n.toFixed(2);

function validNaics(code: string | null | undefined): string | null {
  return code && NAICS_RE.test(code) ? code : null;
}

interface NoticeShape {
  noticeId?: unknown;
  title?: unknown;
  fullParentPathName?: unknown;
  naicsCode?: unknown;
  description?: unknown;
  responseDeadLine?: unknown; // SAM.gov's spelling (capital L) — ISO timestamp string
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Parse SAM.gov's `responseDeadLine` ISO string into a Date; null on absent/invalid. */
function parseDeadline(v: unknown): Date | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date as SAM.gov's required MM/dd/yyyy. */
function formatSamDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Posting-window size in days for the ingest query (SAM_POSTED_WINDOW_DAYS, default 7, clamped 1..365). */
function samWindowDays(): number {
  const raw = Number(process.env.SAM_POSTED_WINDOW_DAYS);
  if (!Number.isFinite(raw) || raw < 1) return 7;
  return Math.min(Math.floor(raw), 365);
}

/** Optional SAM `typeOfSetAside` codes (SAM_SET_ASIDE, comma-separated). Empty → no set-aside filter. */
function samSetAsideFilter(): string[] {
  return (process.env.SAM_SET_ASIDE ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build the SAM.gov Opportunities API v2 search URL for ONE NAICS code. PURE + exported so it is
 * unit-testable without a network. `postedFrom`/`postedTo` are REQUIRED by the API (a missing window is a
 * 400), so we always include a bounded recent window (≤ 1 year). `ncode` is SINGLE-VALUED in SAM's API — a
 * comma-joined list silently returns zero results — so the ingest queries once PER NAICS and merges (see
 * ingestSolicitations). Set-asides are NOT filtered by default: the firm wants to see Total-Small-Business
 * AND unrestricted notices and screen them at triage (CLAUDE.md §6.7).
 */
export function buildSamSearchUrl(
  naicsCode: string,
  apiKey: string,
  opts: { now: Date; windowDays: number; setAside?: readonly string[] },
): string {
  const postedTo = formatSamDate(opts.now);
  const postedFrom = formatSamDate(new Date(opts.now.getTime() - opts.windowDays * 86_400_000));
  const params = new URLSearchParams({
    ncode: naicsCode,
    postedFrom,
    postedTo,
    limit: "100",
    api_key: apiKey,
  });
  if (opts.setAside && opts.setAside.length > 0) {
    params.set("typeOfSetAside", opts.setAside.join(","));
  }
  return `https://api.sam.gov/opportunities/v2/search?${params.toString()}`;
}

/* ===================================================================================
 * INGEST (SAM.gov) — fetch + idempotent upsert. No triage, no email. Returns new ids.
 * =================================================================================== */
export async function ingestSolicitations(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string },
): Promise<IngestedSolicitation[]> {
  const { orgId } = args;

  // Fail fast on a missing key: refuse to fetch with an empty key (which would NOT return real results) —
  // the operator must see "stop and report", never a faked or empty success (CLAUDE.md §1).
  const apiKey = process.env.SAM_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "SAM_API_KEY is not set — refusing to query SAM.gov with an empty key (no fake results). " +
        "Set SAM_API_KEY in the runtime environment to ingest real opportunities.",
    );
  }

  const [org] = await tx
    .select({ directives: orgs.directives })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  const configured = org?.directives?.naicsCodes;
  const naics = configured && configured.length > 0 ? configured : [...DEFAULT_NAICS];

  // SAM's `ncode` is single-valued — a comma-joined list returns zero. Query ONCE PER NAICS and merge,
  // deduping by noticeId (one notice can carry a NAICS we query under more than one code). A single
  // NAICS fetch error is tolerated so one flaky/empty code never drops the others, BUT if EVERY code
  // errors we rethrow — never report a faked/empty success when SAM was actually unreachable (§1).
  const now = new Date();
  const windowDays = samWindowDays();
  const setAside = samSetAsideFilter();
  const byNotice = new Map<string, NoticeShape>();
  let fetchErrors = 0;
  let firstError: unknown = null;
  for (const code of naics) {
    const url = buildSamSearchUrl(code, apiKey, { now, windowDays, setAside });
    try {
      const { bytes } = await deps.fetchDoc(url, { allowedTypes: ["application/json"] });
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { opportunitiesData?: unknown };
      if (Array.isArray(parsed?.opportunitiesData)) {
        for (const n of parsed.opportunitiesData as NoticeShape[]) {
          const noticeId = asString(n.noticeId);
          if (noticeId && !byNotice.has(noticeId)) byNotice.set(noticeId, n);
        }
      }
    } catch (err) {
      // Malformed payload OR a fetch failure for THIS code — count it; continue to the next code.
      fetchErrors += 1;
      firstError ??= err;
    }
  }
  if (fetchErrors === naics.length && firstError) {
    // Every NAICS query failed — surface it (the cron retries) rather than committing a false empty run.
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }
  const notices = [...byNotice.values()];

  const ingested: IngestedSolicitation[] = [];
  for (const n of notices) {
    const noticeId = asString(n.noticeId);
    if (!noticeId) continue;

    const rows = await tx
      .insert(solicitations)
      .values({
        orgId,
        noticeId,
        title: asString(n.title) ?? "Untitled solicitation",
        agency: asString(n.fullParentPathName) ?? null,
        naicsCode: validNaics(asString(n.naicsCode)),
        responseDeadline: parseDeadline(n.responseDeadLine),
        scopeText: asString(n.description) ?? "", // raw SOW — treated as DATA at triage time
        status: "PENDING_TRIAGE",
      })
      // Idempotent on the (org_id, notice_id) unique index — re-running a cron never double-ingests.
      .onConflictDoNothing({ target: [solicitations.orgId, solicitations.noticeId] })
      .returning({ id: solicitations.id });

    const inserted = rows[0];
    if (!inserted) continue;
    ingested.push({ id: inserted.id, noticeId });
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "SOLICITATION_INGESTED",
      entityType: "solicitations",
      entityId: inserted.id,
      after: { noticeId, title: asString(n.title) ?? null },
    });
  }
  return ingested;
}

/* ===================================================================================
 * TRIAGE — write a RECOMMENDATION and STOP. No outreach. No email. No advance past
 * TRIAGE_COMPLETE. On FailClosedError, leave the row PENDING_TRIAGE for human review.
 * =================================================================================== */
export async function triage(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string; solicitationId: string },
): Promise<{ status: "TRIAGE_COMPLETE" | "FAILED_CLOSED" | "NOT_FOUND" }> {
  const { orgId, solicitationId } = args;

  const [sol] = await tx
    .select()
    .from(solicitations)
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)))
    .limit(1);
  if (!sol) return { status: "NOT_FOUND" };

  let verdict;
  try {
    verdict = await deps.ai.triageSolicitation({
      title: sol.title,
      agency: sol.agency ?? undefined,
      scopeText: sol.scopeText ?? "",
    });
  } catch (err) {
    if (err instanceof FailClosedError) {
      // Fail closed: do NOT advance. The row stays PENDING_TRIAGE; the audit records why.
      await writeAudit(tx, {
        orgId,
        actorType: "SYSTEM",
        action: "SOLICITATION_TRIAGE_FAILED_CLOSED",
        entityType: "solicitations",
        entityId: solicitationId,
        after: { stage: err.stage },
      });
      return { status: "FAILED_CLOSED" };
    }
    throw err;
  }

  await tx
    .update(solicitations)
    .set({
      status: "TRIAGE_COMPLETE", // recommendation only — a human approves sourcing next (no advance here)
      feasibilityScore: verdict.feasibilityScore,
      zeroFloatFit: mapZeroFloatFit(verdict.zeroFloatFit, verdict.feasibilityScore),
      rejectionReasons: verdict.rejectionReasons,
      // Persist the advisory verdict so the operator sees it on the console (was audit-only). Display
      // only — a human still approves sourcing or marks no-go; nothing here advances state (§2).
      triageSummary: verdict.summary,
      triageRecommendation: verdict.recommendation,
      contractType: mapContractType(verdict.contractType) ?? sol.contractType,
      naicsCode: validNaics(verdict.naics) ?? sol.naicsCode,
      triageModel: MODELS.triage,
      triagedAt: new Date(),
    })
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)));

  await writeAudit(tx, {
    orgId,
    actorType: "SYSTEM",
    action: "SOLICITATION_TRIAGED",
    entityType: "solicitations",
    entityId: solicitationId,
    after: {
      recommendation: verdict.recommendation,
      feasibilityScore: verdict.feasibilityScore,
      zeroFloatFit: verdict.zeroFloatFit,
      summary: verdict.summary,
    },
  });
  return { status: "TRIAGE_COMPLETE" };
}

/* ===================================================================================
 * ON SOURCING APPROVED (post human gate) — DRAFT outreach only. No tokens minted here,
 * no email sent. Triggered by hermes/sourcing.approved, which only an admin action emits.
 * =================================================================================== */
export async function onSourcingApproved(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string; solicitationId: string; approvedBy: string },
): Promise<{ drafted: DraftedOutreach[] }> {
  const { orgId, solicitationId } = args;

  const [sol] = await tx
    .select()
    .from(solicitations)
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)))
    .limit(1);
  if (!sol) return { drafted: [] };

  // Defense in depth: the human approval action set sourcing_approved_by before emitting the event.
  // If it is not set, refuse to draft (something emitted the gate event out of band).
  if (!sol.sourcingApprovedBy) {
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "SOURCING_DRAFT_REFUSED_NO_APPROVER",
      entityType: "solicitations",
      entityId: solicitationId,
    });
    return { drafted: [] };
  }

  const brief = await deps.ai.draftSOW({ title: sol.title, scopeText: sol.scopeText ?? "" });
  const bodyText =
    `${brief.summary}\n\nKey requirements:\n- ${brief.keyRequirements.join("\n- ")}`.trim();
  const subject = `Subcontracting opportunity: ${brief.title}`;

  // Only prospects we can actually reach and that have not opted out / been declined.
  const prospects = await tx
    .select()
    .from(vendorProspects)
    .where(
      and(
        eq(vendorProspects.orgId, orgId),
        inArray(vendorProspects.status, ["NEW", "SCREENED", "CONTACTED", "RESPONDED", "QUALIFIED"]),
      ),
    );

  const drafted: DraftedOutreach[] = [];
  for (const p of prospects) {
    if (!p.contactEmail) continue; // cannot send without an address — skip silently at draft

    const score = await deps.ai.scoreProspect({
      solicitationScope: sol.scopeText ?? "",
      prospectCapability: p.capabilitiesText ?? "",
    });
    if (score.recommendation === "REJECT") continue;

    const rows = await tx
      .insert(outreachCampaigns)
      .values({
        orgId,
        solicitationId,
        prospectId: p.id,
        step: "DAY_0",
        status: "PENDING_APPROVAL", // awaits the human approval action; tokens are NOT minted until send
        subject,
        body: bodyText,
        // Surface WHY this sub was matched so the human sees it before approving (was audit-only).
        // Recommendation-only — the human still approves/rejects each campaign (§2). REJECT prospects
        // are skipped above, so their reasoning stays audit-only by design.
        aiMatchScore: score.score,
        aiCapabilityMatch: String(score.capabilityMatch), // numeric column ⇒ string
        aiStrengths: score.strengths,
        aiGaps: score.gaps,
        aiRecommendation: score.recommendation,
      })
      .returning({ id: outreachCampaigns.id });

    const created = rows[0];
    if (!created) continue;
    drafted.push({ outreachId: created.id, prospectId: p.id });
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "OUTREACH_DRAFTED",
      entityType: "outreach_campaigns",
      entityId: created.id,
      after: { prospectId: p.id, score: score.score },
    });
  }

  // Solicitation now waits on the human (AWAITING_APPROVAL). Nothing was sent.
  await tx
    .update(solicitations)
    .set({ status: "AWAITING_APPROVAL" })
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)));

  return { drafted };
}

/* ===================================================================================
 * SEND OUTREACH — the gated send. REFUSES unless the campaign is APPROVED with a recorded
 * human approver. Mints the single-purpose tokens ONLY now (after approval), stores their
 * hashes, sends the email, and marks SENT. The DB CHECKs are the final backstop.
 * =================================================================================== */
export async function sendOutreach(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string; outreachId: string; approvedBy: string },
): Promise<{ status: "SENT" | "REFUSED" | "SKIPPED_NO_EMAIL" }> {
  const { orgId, outreachId, approvedBy } = args;

  const [campaign] = await tx
    .select()
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.id, outreachId)))
    .limit(1);
  if (!campaign) return { status: "REFUSED" };

  // THE GATE, in code: a model score can never reach this branch. Only an APPROVED campaign with a
  // recorded human approver may send. (The durable waitForEvent gate and the DB CHECK also enforce it.)
  if (campaign.status !== "APPROVED" || !campaign.approvedBy) {
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "OUTREACH_SEND_REFUSED_NOT_APPROVED",
      entityType: "outreach_campaigns",
      entityId: outreachId,
      after: { status: campaign.status },
    });
    return { status: "REFUSED" };
  }

  const [prospect] = await tx
    .select()
    .from(vendorProspects)
    .where(and(eq(vendorProspects.orgId, orgId), eq(vendorProspects.id, campaign.prospectId)))
    .limit(1);
  if (!prospect?.contactEmail) {
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "OUTREACH_SKIPPED_NO_EMAIL",
      entityType: "outreach_campaigns",
      entityId: outreachId,
    });
    return { status: "SKIPPED_NO_EMAIL" };
  }

  // Mint the single-purpose tokens NOW (post-approval) and store only their hashes (CLAUDE.md §7).
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const quoteToken = mintToken({
    purpose: "QUOTE_SUBMISSION",
    orgId,
    prospectId: prospect.id,
    solicitationId: campaign.solicitationId,
    ttlDays: TOKEN_TTL_DAYS,
  });
  const optoutToken = mintToken({
    purpose: "OPT_OUT",
    orgId,
    prospectId: prospect.id,
    ttlDays: TOKEN_TTL_DAYS,
  });
  const quoteUrl = `${appBaseUrl()}/quote/${quoteToken}`;
  const optoutUrl = `${appBaseUrl()}/optout/${optoutToken}`;

  const email = await deps.sendOutreachEmail({
    to: prospect.contactEmail,
    subject: campaign.subject,
    prospectName: prospect.companyName,
    bodyText: campaign.body, // autoescaped by React Email at render
    quoteUrl,
    optoutUrl,
  });

  await tx
    .update(outreachCampaigns)
    .set({
      status: "SENT",
      sentAt: new Date(),
      quoteTokenHash: hashToken(quoteToken),
      quoteTokenExpiresAt: expiresAt,
      optoutTokenHash: hashToken(optoutToken),
      optoutTokenExpiresAt: expiresAt,
    })
    .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.id, outreachId)));

  // The solicitation advances to SOURCING_IN_PROGRESS only because a human approved (sourcing_approved_by
  // was set upstream; the sourcing_gate CHECK requires it).
  await tx
    .update(solicitations)
    .set({ status: "SOURCING_IN_PROGRESS" })
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, campaign.solicitationId)));

  await writeAudit(tx, {
    orgId,
    actorType: "ADMIN", // a human authorized this send
    actorUserId: approvedBy,
    action: "OUTREACH_SENT",
    entityType: "outreach_campaigns",
    entityId: outreachId,
    after: { emailId: email.id ?? null },
  });
  return { status: "SENT" };
}

/** Record that an outreach approval never arrived within the gate window. Never sends. */
export async function expireOutreach(
  tx: Tx,
  args: { orgId: string; outreachId: string },
): Promise<void> {
  const { orgId, outreachId } = args;
  await tx
    .update(outreachCampaigns)
    .set({ status: "CANCELLED" })
    .where(
      and(
        eq(outreachCampaigns.orgId, orgId),
        eq(outreachCampaigns.id, outreachId),
        eq(outreachCampaigns.status, "PENDING_APPROVAL"),
      ),
    );
  await writeAudit(tx, {
    orgId,
    actorType: "SYSTEM",
    action: "OUTREACH_EXPIRED_NO_APPROVAL",
    entityType: "outreach_campaigns",
    entityId: outreachId,
  });
}

/* ===================================================================================
 * RANK QUOTES — analyze + rank received quotes for ONE solicitation. Recommendation only;
 * advances to PRICING_PENDING (the human-review pricing state). On FailClosedError, no advance.
 * =================================================================================== */
export async function rankQuotes(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string; solicitationId: string },
): Promise<{ ranked: number; status: "PRICING_PENDING" | "FAILED_CLOSED" | "NONE" }> {
  const { orgId, solicitationId } = args;

  const [sol] = await tx
    .select({ scopeText: solicitations.scopeText })
    .from(solicitations)
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)))
    .limit(1);
  if (!sol) return { ranked: 0, status: "NONE" };

  const quotes = await tx
    .select()
    .from(vendorQuotes)
    .where(
      and(
        eq(vendorQuotes.orgId, orgId),
        eq(vendorQuotes.solicitationId, solicitationId),
        eq(vendorQuotes.status, "SUBMITTED"),
        isNull(vendorQuotes.aiRank),
      ),
    );
  if (quotes.length === 0) return { ranked: 0, status: "NONE" };

  // Resolve a display name per quote (prospect or vendor). The notes field is fenced as DATA downstream.
  const prospectIds = quotes.map((q) => q.prospectId).filter((v): v is string => Boolean(v));
  const prospectNames = new Map<string, string>();
  if (prospectIds.length > 0) {
    const ps = await tx
      .select({ id: vendorProspects.id, name: vendorProspects.companyName })
      .from(vendorProspects)
      .where(and(eq(vendorProspects.orgId, orgId), inArray(vendorProspects.id, prospectIds)));
    for (const p of ps) prospectNames.set(p.id, p.name);
  }

  let ranking;
  try {
    ranking = await deps.ai.evaluateQuotes({
      solicitationScope: sol.scopeText ?? "",
      quotes: quotes.map((q) => ({
        quoteId: q.id,
        vendorName: (q.prospectId && prospectNames.get(q.prospectId)) || "subcontractor",
        totalPrice: String(q.totalPrice ?? "0"),
        notes: q.notes ?? undefined, // fenced as untrusted inside evaluateQuotes
      })),
    });
  } catch (err) {
    if (err instanceof FailClosedError) {
      await writeAudit(tx, {
        orgId,
        actorType: "SYSTEM",
        action: "QUOTES_RANKING_FAILED_CLOSED",
        entityType: "solicitations",
        entityId: solicitationId,
        after: { stage: err.stage },
      });
      return { ranked: 0, status: "FAILED_CLOSED" };
    }
    throw err;
  }

  const validIds = new Set(quotes.map((q) => q.id));
  let ranked = 0;
  for (const r of ranking.rankings) {
    if (!validIds.has(r.quoteId)) continue; // ignore any id the model invented
    await tx
      .update(vendorQuotes)
      // Persist the per-quote score + risks (were discarded) alongside the existing rank/rationale.
      // Operator-only (0012 withholds ai_score/ai_risks from the vendor role); display only.
      .set({
        aiRank: r.rank,
        aiRationale: r.rationale,
        aiScore: String(r.score), // numeric column ⇒ string
        aiRisks: r.risks,
        evaluatedAt: new Date(),
      })
      .where(and(eq(vendorQuotes.orgId, orgId), eq(vendorQuotes.id, r.quoteId)));
    ranked += 1;
  }

  await tx
    .update(solicitations)
    // Surface the injection attempts the model flagged (was audit-only) so the operator sees that
    // some quote text tried to manipulate the ranking and was ignored. Operator-only (0012).
    .set({ status: "PRICING_PENDING", quoteInjectionAttempts: ranking.injectionAttemptsDetected })
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)));

  await writeAudit(tx, {
    orgId,
    actorType: "SYSTEM",
    action: "QUOTES_RANKED",
    entityType: "solicitations",
    entityId: solicitationId,
    after: { ranked, injectionAttemptsDetected: ranking.injectionAttemptsDetected },
  });
  return { ranked, status: "PRICING_PENDING" };
}

/** Solicitation ids in this org that have SUBMITTED, not-yet-ranked quotes. */
export async function findUnrankedSolicitationIds(
  tx: Tx,
  args: { orgId: string },
): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ solicitationId: vendorQuotes.solicitationId })
    .from(vendorQuotes)
    .where(
      and(
        eq(vendorQuotes.orgId, args.orgId),
        eq(vendorQuotes.status, "SUBMITTED"),
        isNull(vendorQuotes.aiRank),
      ),
    );
  return rows.map((r) => r.solicitationId);
}

/* ===================================================================================
 * DRAFT PROPOSAL BID — triggered by the hermes/quote.selected HUMAN-GATE event (emitted only by an
 * admin selecting a winner). Drafts a PRICED bid decision-brief into a proposals row: deterministic
 * pricing scenarios + compliance + §3 bid checklist (engine writes PROSE only), advances the
 * solicitation to PROPOSAL_DRAFT, and STOPS. It never submits and never sends — the human walks the
 * proposal through counsel-review → ready → submit on the review surface, where readyForLiveSubmission
 * structurally blocks any real bid on the provisional baseline (CLAUDE.md §2/§6). Fail-closed: a NULL
 * is_services classification, zero line items, or a FailClosedError leaves PRICING_PENDING with no row.
 * Idempotent: a second event for a solicitation that already has a proposal is a no-op.
 * =================================================================================== */
export async function draftProposalBid(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string; solicitationId: string; quoteId: string; selectedBy: string },
): Promise<
  | { status: "DRAFTED"; proposalId: string }
  | { status: "ALREADY_DRAFTED" }
  | { status: "NOT_FOUND" }
  | { status: "REFUSED" }
  | { status: "FAILED_CLOSED" }
> {
  const { orgId, solicitationId } = args;

  // Idempotency layer 1: one proposal per solicitation. A retried/duplicate event is a no-op.
  const existing = await tx
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(eq(proposals.orgId, orgId), eq(proposals.solicitationId, solicitationId)))
    .limit(1);
  if (existing.length > 0) {
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "PROPOSAL_DRAFT_SKIPPED_EXISTS",
      entityType: "solicitations",
      entityId: solicitationId,
      after: { proposalId: existing[0]!.id },
    });
    return { status: "ALREADY_DRAFTED" };
  }

  const [sol] = await tx
    .select()
    .from(solicitations)
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, solicitationId)))
    .limit(1);
  if (!sol) return { status: "NOT_FOUND" };

  // Winner gate (defense in depth): only a SELECTED quote represents the human's selection. If there is no
  // SELECTED quote for this id, refuse — something emitted the gate event out of band.
  const [q] = await tx
    .select()
    .from(vendorQuotes)
    .where(
      and(
        eq(vendorQuotes.orgId, orgId),
        eq(vendorQuotes.id, args.quoteId),
        eq(vendorQuotes.solicitationId, solicitationId),
        eq(vendorQuotes.status, "SELECTED"),
      ),
    )
    .limit(1);
  if (!q) {
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "PROPOSAL_DRAFT_REFUSED_NO_WINNER",
      entityType: "solicitations",
      entityId: solicitationId,
      after: { quoteId: args.quoteId },
    });
    return { status: "REFUSED" };
  }

  // is_services NULL fail-closed: drafting on a coerced `false` would fail OPEN on the FAR 52.219-14
  // services cap. Leave PRICING_PENDING for human classification.
  if (sol.isServices === null) {
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "PROPOSAL_DRAFT_FAILED_CLOSED",
      entityType: "solicitations",
      entityId: solicitationId,
      after: { stage: "is_services_null" },
    });
    return { status: "FAILED_CLOSED" };
  }

  const lines = await tx
    .select()
    .from(vendorQuoteLineItems)
    .where(and(eq(vendorQuoteLineItems.orgId, orgId), eq(vendorQuoteLineItems.quoteId, q.id)));
  // No line items → we cannot build a cost model, and proposals.contract_type (NOT NULL, no UNKNOWN) has
  // no concrete value to take. Fail closed.
  if (lines.length === 0) {
    await writeAudit(tx, {
      orgId,
      actorType: "SYSTEM",
      action: "PROPOSAL_DRAFT_FAILED_CLOSED",
      entityType: "solicitations",
      entityId: solicitationId,
      after: { stage: "no_line_items" },
    });
    return { status: "FAILED_CLOSED" };
  }

  const [org] = await tx
    .select({ directives: orgs.directives })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  const dir = parseDirectives(org?.directives);
  const rates = dir.illustrativeIndirectRates;

  // Benchmark award amounts for this NAICS (finite, > 0). Omit the field entirely if we have none.
  let benchmarkAwardAmounts: number[] | undefined;
  if (sol.naicsCode) {
    const awards = await tx
      .select({ amount: awardIntelligence.awardAmount })
      .from(awardIntelligence)
      .where(and(eq(awardIntelligence.orgId, orgId), eq(awardIntelligence.naicsCode, sol.naicsCode)));
    const amts = awards.map((a) => Number(a.amount)).filter((n) => Number.isFinite(n) && n > 0);
    if (amts.length > 0) benchmarkAwardAmounts = amts;
  }

  // Deterministic substrate (all money coerced from numeric strings).
  const pricingLines = lines.map((l) => ({
    costType: l.costType,
    quantity: num(l.quantity),
    unitRate: num(l.unitRate),
  }));
  const extLine = (l: (typeof lines)[number]): number => num(l.unitRate) * num(l.quantity);
  const cost = buildCostModel(pricingLines, rates).totalCost;
  const priceProxy = cost * (1 + rates.fee);
  const subcontractCost = lines
    .filter((l) => l.costType === "SUBCONTRACT")
    .reduce((s, l) => s + extLine(l), 0);
  const nonSimSubsTotal = lines
    .filter((l) => l.costType === "SUBCONTRACT" && l.similarlySituated !== true)
    .reduce((s, l) => s + extLine(l), 0);

  const winningQuoteSummary = [
    `Selected subcontractor quote total: ${q.totalPrice ?? money2(priceProxy)}.`,
    "Line items:",
    ...lines.map(
      (l) => `- ${l.costType} ${l.description}: ${num(l.quantity)} × ${num(l.unitRate)} = ${extLine(l)}`,
    ),
    q.notes ? `Notes: ${q.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let pkg;
  try {
    pkg = await deps.ai.draftBid({
      solicitationTitle: sol.title,
      scopeText: sol.scopeText ?? "",
      winningQuoteSummary, // q.notes flows through here; the engine fences it as untrusted data
      provisionalRatesMode: dir.provisionalRatesMode,
      pricing: {
        contractType: sol.contractType ?? "UNKNOWN",
        lines: pricingLines,
        rates,
        ...(benchmarkAwardAmounts ? { benchmarkAwardAmounts } : {}),
      },
      compliance: {
        setAside: mapSetAside(sol.setAsideType),
        isServices: sol.isServices, // NULL handled above — a real boolean here
        contractType: sol.contractType ?? "UNKNOWN",
        totalGovtPayment: priceProxy,
        paymentsToNonSimilarlySituatedSubs: nonSimSubsTotal,
        subcontractCost,
        totalCostOfWork: cost,
        price: priceProxy,
        cost,
        awardDate: sol.responseDeadline ?? new Date(),
        isDefense: sol.isDefense,
        hasAdequatePriceCompetition: true, // also stored on the row; human-overridable
        orgSocioEconomicCerts: [], // firm holds none (CLAUDE.md §6.7)
        valueUsd: priceProxy,
        lineItems: lines.map((l) => ({ costType: l.costType, markupPct: num(l.markupPct) })),
        tmZeroMarkupCostTypes: dir.tmZeroMarkupCostTypes as ("LABOR" | "MATERIAL" | "ODC" | "SUBCONTRACT" | "TRAVEL")[],
      },
      bid: {
        formType: "UCF_PART15",
        // extendedAmount MUST equal unitRate × quantity or reconcilePricingMath BLOCKs (bid.ts). The DB
        // extended_amount bakes in markup, so we recompute it here — the generated draft reconciles by
        // construction; markup lives in the cost model, not the line arithmetic.
        pricingMath: {
          lines: lines.map((l, i) => ({
            clin: String(i + 1),
            unitRate: num(l.unitRate),
            quantity: num(l.quantity),
            extendedAmount: extLine(l),
          })),
          statedGrandTotal: lines.reduce((s, l) => s + extLine(l), 0),
        },
      },
      submissionGates: {
        counselConfirmed: !hasUnconfirmedCounselThresholds(dir),
        actualRatesLoaded: !dir.provisionalRatesMode,
        samRegistrationActive: dir.registration.samRegistrationActive,
        cageAssigned: dir.registration.cageAssigned,
        humanSignature: false,
        counselReviewed: false,
      },
    });
  } catch (err) {
    if (err instanceof FailClosedError) {
      await writeAudit(tx, {
        orgId,
        actorType: "SYSTEM",
        action: "PROPOSAL_DRAFT_FAILED_CLOSED",
        entityType: "solicitations",
        entityId: solicitationId,
        after: { stage: err.stage },
      });
      return { status: "FAILED_CLOSED" };
    }
    throw err; // transient → Inngest retries
  }

  const [inserted] = await tx
    .insert(proposals)
    .values({
      orgId,
      solicitationId,
      selectedQuoteId: q.id,
      contractType: lines[0]!.contractType, // concrete (FFP/TM/FFP_MILESTONE) — no UNKNOWN allowed here
      status: "DRAFT", // submittedBy/At + counselReviewedBy/At stay NULL — the no-auto-submit invariant
      // The drafted ProposalNarrative (prose only — display-only, gates nothing; §2/§6). No narrative
      // value influences pricing/compliance/blockers, which remain deterministic.
      narrative: pkg.narrative,
      pricingScenarios: pkg.pricing,
      complianceChecklist: {
        compliance: pkg.compliance,
        bidChecklist: pkg.bidChecklist,
        liveSubmission: pkg.liveSubmission,
        blocking: pkg.blocking,
        provisional: pkg.provisional,
        watermark: pkg.watermark,
        formProfile: pkg.formProfile,
        disclaimer: pkg.disclaimer,
      },
      governmentPaymentBasis: money2(priceProxy),
      nonSimilarlySituatedSubsTotal: money2(nonSimSubsTotal),
      totalCostOfWork: money2(cost),
      adequatePriceCompetition: true,
    })
    .returning({ id: proposals.id });

  // Idempotency layer 2 / advance: only a PRICING_PENDING solicitation advances (the predicate is the
  // guard). The sourcing_gate CHECK is already satisfied — it reached PRICING_PENDING with an approver.
  await tx
    .update(solicitations)
    .set({ status: "PROPOSAL_DRAFT" })
    .where(
      and(
        eq(solicitations.orgId, orgId),
        eq(solicitations.id, solicitationId),
        eq(solicitations.status, "PRICING_PENDING"),
      ),
    );

  await writeAudit(tx, {
    orgId,
    actorType: "SYSTEM",
    action: "PROPOSAL_DRAFTED",
    entityType: "proposals",
    entityId: inserted!.id,
    after: {
      proposalId: inserted!.id,
      blocking: pkg.blocking,
      provisional: pkg.provisional,
      liveReady: pkg.liveSubmission.ready,
    },
  });
  return { status: "DRAFTED", proposalId: inserted!.id };
}

/* ===================================================================================
 * READ-ONLY MONITORS — surface information for the operator; never advance state.
 * =================================================================================== */

/** Upsert USASpending award benchmarks into the read-only award_intelligence cache. */
export async function ingestUsaspending(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string },
): Promise<{ upserted: number }> {
  const { orgId } = args;
  const [org] = await tx
    .select({ directives: orgs.directives })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  const naics = org?.directives?.naicsCodes?.length ? org.directives.naicsCodes : [...DEFAULT_NAICS];

  const { bytes } = await deps.fetchDoc("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    allowedTypes: ["application/json"],
    body: JSON.stringify({
      filters: { naics_codes: naics, award_type_codes: ["A", "B", "C", "D"] },
      fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "NAICS"],
      limit: 100,
    }),
  });

  let results: Record<string, unknown>[] = [];
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { results?: unknown };
    if (Array.isArray(parsed?.results)) results = parsed.results as Record<string, unknown>[];
  } catch {
    return { upserted: 0 };
  }

  let upserted = 0;
  for (const row of results) {
    const awardUniqueKey =
      asString(row["generated_internal_id"]) ?? asString(row["Award ID"]) ?? undefined;
    if (!awardUniqueKey) continue;
    const amountRaw = row["Award Amount"];
    const awardAmount =
      typeof amountRaw === "number" ? String(amountRaw) : (asString(amountRaw) ?? null);
    await tx
      .insert(awardIntelligence)
      .values({
        orgId,
        awardUniqueKey,
        piid: asString(row["Award ID"]) ?? null,
        naicsCode: validNaics(asString(row["NAICS"])),
        agency: asString(row["Awarding Agency"]) ?? null,
        recipient: asString(row["Recipient Name"]) ?? null,
        awardAmount,
        awardAmountKind: "ESTIMATED",
        raw: row,
        fetchedAt: new Date(),
      })
      .onConflictDoNothing({ target: [awardIntelligence.orgId, awardIntelligence.awardUniqueKey] });
    upserted += 1;
  }
  return { upserted };
}

/** Solicitations with a response deadline inside the 72h horizon. Read-only. */
export async function monitorDeadlines(tx: Tx, args: { orgId: string }): Promise<BriefItem[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + DEADLINE_HORIZON_MS);
  const rows = await tx
    .select({
      id: solicitations.id,
      title: solicitations.title,
      deadline: solicitations.responseDeadline,
    })
    .from(solicitations)
    .where(
      and(
        eq(solicitations.orgId, args.orgId),
        inArray(solicitations.status, [...LIVE_STATUSES]),
        gte(solicitations.responseDeadline, now),
        lte(solicitations.responseDeadline, horizon),
      ),
    )
    .orderBy(solicitations.responseDeadline);
  return rows.map((r) => ({
    label: r.title,
    detail: r.deadline ? `due ${r.deadline.toISOString()}` : undefined,
  }));
}

/** Overdue AR follow-ups (scheduled + past due). Read-only — no chase email is sent yet (Phase 7). */
export async function runArFollowups(tx: Tx, args: { orgId: string }): Promise<BriefItem[]> {
  const rows = await tx
    .select({ id: arFollowups.id, amountDue: arFollowups.amountDue, dueDate: arFollowups.dueDate })
    .from(arFollowups)
    .where(
      and(
        eq(arFollowups.orgId, args.orgId),
        eq(arFollowups.status, "SCHEDULED"),
        lte(arFollowups.dueDate, new Date()),
      ),
    );
  return rows.map((r) => ({
    label: `AR ${r.id.slice(0, 8)}`,
    detail: `${r.amountDue ?? "?"} due ${r.dueDate ? r.dueDate.toISOString() : "n/a"}`,
  }));
}

/**
 * Compose + email the operator's morning brief: triage recommendations awaiting review, outreach
 * awaiting approval, freshly ranked quotes, deadlines, and overdue AR. This is an INTERNAL email to the
 * admin (not a third party), so it is informational — not a Prime-Directive gate.
 */
export async function composeMorningBrief(
  tx: Tx,
  deps: LogicDeps,
  args: { orgId: string },
): Promise<{ sent: boolean }> {
  const { orgId } = args;

  const [org] = await tx
    .select({ name: orgs.name })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  const admins = await tx
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.role, "ADMIN"), eq(users.isActive, true)));
  const to = admins.map((a) => a.email).filter(Boolean);
  if (to.length === 0) return { sent: false };

  const triageReadyRows = await tx
    .select({
      title: solicitations.title,
      score: solicitations.feasibilityScore,
      recommendation: solicitations.triageRecommendation,
    })
    .from(solicitations)
    .where(and(eq(solicitations.orgId, orgId), eq(solicitations.status, "TRIAGE_COMPLETE")))
    .orderBy(desc(solicitations.feasibilityScore))
    .limit(20);

  // Read-only alert: any LIVE solicitation whose quotes carried injection attempts (operator signal).
  const injectionRows = await tx
    .select({ id: solicitations.id })
    .from(solicitations)
    .where(
      and(
        eq(solicitations.orgId, orgId),
        inArray(solicitations.status, [...LIVE_STATUSES]),
        sql`jsonb_array_length(${solicitations.quoteInjectionAttempts}) > 0`,
      ),
    );

  const awaitingRows = await tx
    .select({ id: outreachCampaigns.id, subject: outreachCampaigns.subject })
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.orgId, orgId), eq(outreachCampaigns.status, "PENDING_APPROVAL")))
    .limit(20);

  const rankedRecent = await tx
    .select({ id: vendorQuotes.id })
    .from(vendorQuotes)
    .where(and(eq(vendorQuotes.orgId, orgId), eq(vendorQuotes.status, "SUBMITTED")));

  const deadlines = await monitorDeadlines(tx, { orgId });
  const arOverdue = await runArFollowups(tx, { orgId });

  await deps.sendBriefEmail({
    to,
    orgName: org?.name ?? "Burger Consulting",
    dateLabel: new Date().toISOString().slice(0, 10),
    triageReady: triageReadyRows.map((r) => ({
      label: r.title,
      detail: `feasibility ${r.score ?? "?"}${r.recommendation ? ` · ${r.recommendation}` : ""}`,
    })),
    awaitingApproval: awaitingRows.map((r) => ({ label: r.subject })),
    rankedQuotes: rankedRecent.length,
    deadlines,
    arOverdue,
    injectionAlert:
      injectionRows.length > 0
        ? `${injectionRows.length} live solicitation(s) had quote(s) that attempted to influence the AI ` +
          `ranking — flagged and ignored. Review the rankings before relying on them.`
        : undefined,
    approvalsUrl: `${appBaseUrl()}/admin/approvals`,
  });

  await writeAudit(tx, {
    orgId,
    actorType: "SYSTEM",
    action: "MORNING_BRIEF_SENT",
    entityType: "orgs",
    entityId: orgId,
    after: { recipients: to.length },
  });
  return { sent: true };
}
