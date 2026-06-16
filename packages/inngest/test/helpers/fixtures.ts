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
  vendorQuoteLineItems,
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
    isServices?: boolean | null;
    setAsideType?: string;
    contractType?: string | null;
    naicsCode?: string | null;
    isDefense?: boolean;
  } = {},
): Promise<string> {
  const approvedBy = opts.sourcingApprovedBy ?? null;
  // The is_services_provenance CHECK requires a source whenever is_services is non-null.
  const isServices = opts.isServices === undefined ? null : opts.isServices;
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
      isServices,
      isServicesSource: isServices === null ? null : ("HUMAN" as never),
      setAsideType: (opts.setAsideType ?? "NONE") as never,
      contractType: (opts.contractType ?? null) as never,
      naicsCode: opts.naicsCode ?? null,
      isDefense: opts.isDefense ?? false,
    })
    .returning({ id: solicitations.id });
  return row!.id;
}

/** Insert one quote line item. contract_type is denormalized + synced by a trigger; we set it to satisfy
 *  the NOT NULL + the §6.2 T&M markup-lock CHECK (callers pass FFP unless testing the lock). */
export async function insertLineItem(
  tx: Tx,
  orgId: string,
  opts: {
    quoteId: string;
    costType?: string;
    contractType?: string;
    description?: string;
    quantity?: string;
    unitRate?: string;
    markupPct?: string;
    extendedAmount?: string | null;
    similarlySituated?: boolean | null;
    subSmallBusinessStatus?: string | null;
    subSubcontractNaics?: string | null;
  },
): Promise<string> {
  const [row] = await tx
    .insert(vendorQuoteLineItems)
    .values({
      orgId,
      quoteId: opts.quoteId,
      costType: (opts.costType ?? "LABOR") as never,
      contractType: (opts.contractType ?? "FFP") as never,
      description: opts.description ?? "Senior engineer",
      quantity: opts.quantity ?? "100",
      unitRate: opts.unitRate ?? "150",
      markupPct: opts.markupPct ?? "0",
      extendedAmount: opts.extendedAmount ?? null,
      similarlySituated: opts.similarlySituated ?? null,
      subSmallBusinessStatus: (opts.subSmallBusinessStatus ?? null) as never,
      subSubcontractNaics: opts.subSubcontractNaics ?? null,
    })
    .returning({ id: vendorQuoteLineItems.id });
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
