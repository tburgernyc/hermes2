/**
 * Minimal Drizzle row factories for the logic tests. Each inserts the fewest columns needed to satisfy
 * NOT NULL + CHECK + FK constraints and returns the new id. Inserted via the owner-DSN client inside the
 * surrounding withRollbackTx, so everything is discarded on rollback.
 */
import {
  orgs,
  outreachCampaigns,
  solicitations,
  users,
  vendorProspects,
  vendorQuotes,
  type OrgDirectives,
  type Tx,
} from "@hermes/db";

let counter = 0;
const uniq = (): number => (counter += 1);

/** A schema-valid directives object (thresholds flagged pendingCounsel per CLAUDE.md §6). */
const TEST_DIRECTIVES: OrgDirectives = {
  naicsCodes: ["541511", "541512", "541519"],
  setAsideEligibility: {
    totalSmallBusiness: true,
    eightA: false,
    hubzone: false,
    sdvosb: false,
    wosb: false,
  },
  zeroFloat: { minFeasibilityScore: 6, maxResponseDays: 30 },
  thresholds: {
    priceRealismMinMarginPct: { value: 5, pendingCounsel: true },
    passThroughMaxPct: { value: 70, pendingCounsel: true },
    tinaThresholdUsd: { value: 2_500_000, pendingCounsel: true },
    limitationsOnSubcontractingMaxNonSimilarPct: { value: 50, pendingCounsel: true },
  },
};

export async function insertOrg(tx: Tx): Promise<string> {
  const [row] = await tx
    .insert(orgs)
    .values({ slug: `inngest-test-${uniq()}`, name: "Test Org", directives: TEST_DIRECTIVES })
    .returning({ id: orgs.id });
  return row!.id;
}

export async function insertUser(
  tx: Tx,
  orgId: string,
  opts: { role?: "ADMIN" | "VENDOR" } = {},
): Promise<string> {
  const role = opts.role ?? "ADMIN";
  const [row] = await tx
    .insert(users)
    .values({
      orgId,
      email: `user-${uniq()}@example.test`,
      role,
      passwordHash: role === "ADMIN" ? "!hash" : null,
    })
    .returning({ id: users.id });
  return row!.id;
}

export async function insertSolicitation(
  tx: Tx,
  orgId: string,
  opts: {
    status?: string;
    scopeText?: string;
    sourcingApprovedBy?: string | null;
    responseDeadline?: Date | null;
  } = {},
): Promise<string> {
  const approvedBy = opts.sourcingApprovedBy ?? null;
  const [row] = await tx
    .insert(solicitations)
    .values({
      orgId,
      noticeId: `NOTICE-${uniq()}`,
      title: "Test Solicitation",
      scopeText: opts.scopeText ?? "Provide IT support services.",
      status: (opts.status ?? "PENDING_TRIAGE") as never,
      sourcingApprovedBy: approvedBy,
      sourcingApprovedAt: approvedBy ? new Date() : null,
      responseDeadline: opts.responseDeadline ?? null,
    })
    .returning({ id: solicitations.id });
  return row!.id;
}

export async function insertProspect(
  tx: Tx,
  orgId: string,
  opts: { contactEmail?: string | null; capabilitiesText?: string; status?: string } = {},
): Promise<string> {
  const [row] = await tx
    .insert(vendorProspects)
    .values({
      orgId,
      companyName: `Prospect ${uniq()}`,
      contactEmail:
        opts.contactEmail === undefined ? `prospect-${uniq()}@example.test` : opts.contactEmail,
      capabilitiesText: opts.capabilitiesText ?? "We do IT support.",
      status: (opts.status ?? "NEW") as never,
    })
    .returning({ id: vendorProspects.id });
  return row!.id;
}

export async function insertQuote(
  tx: Tx,
  orgId: string,
  opts: {
    solicitationId: string;
    prospectId: string;
    status?: string;
    totalPrice?: string;
    notes?: string;
  },
): Promise<string> {
  const [row] = await tx
    .insert(vendorQuotes)
    .values({
      orgId,
      solicitationId: opts.solicitationId,
      prospectId: opts.prospectId,
      status: (opts.status ?? "SUBMITTED") as never,
      totalPrice: opts.totalPrice ?? "100000",
      notes: opts.notes ?? null,
    })
    .returning({ id: vendorQuotes.id });
  return row!.id;
}

export async function insertOutreach(
  tx: Tx,
  orgId: string,
  opts: {
    solicitationId: string;
    prospectId: string;
    status?: string;
    approvedBy?: string | null;
    subject?: string;
    body?: string;
  },
): Promise<string> {
  const approvedBy = opts.approvedBy ?? null;
  const [row] = await tx
    .insert(outreachCampaigns)
    .values({
      orgId,
      solicitationId: opts.solicitationId,
      prospectId: opts.prospectId,
      status: (opts.status ?? "PENDING_APPROVAL") as never,
      subject: opts.subject ?? "Subcontracting opportunity",
      body: opts.body ?? "Summary.\n\nKey requirements:\n- one",
      approvedBy,
      approvedAt: approvedBy ? new Date() : null,
    })
    .returning({ id: outreachCampaigns.id });
  return row!.id;
}
