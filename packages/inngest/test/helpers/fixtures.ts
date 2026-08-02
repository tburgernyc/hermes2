/**
 * Minimal Drizzle row factories for the logic tests. Each inserts the fewest columns needed to satisfy
 * NOT NULL + CHECK + FK constraints and returns the new id. Inserted via the owner-DSN client inside the
 * surrounding withRollbackTx, so everything is discarded on rollback.
 */
import {
  orgs,
  outreachCampaigns,
  proposals,
  solicitations,
  users,
  vendorProspects,
  vendorQuoteLineItems,
  vendorQuotes,
  vendors,
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
      // Phase A (§3.6): every ADMIN row must carry an explicit admin_role (CHECK-enforced).
      adminRole: role === "ADMIN" ? "FULL" : null,
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
    /** §3.1 outcome gate: AWARDED/REJECTED/CLOSED requires a recorded human + timestamp. */
    outcomeRecordedBy?: string | null;
    awardDate?: Date | null;
    /** §3.8: the sources-sought/RFI capture track (a separate axis from `status` — see enums.ts). */
    noticeType?: string | null;
    rfiTrackStatus?: string | null;
    convertedFromSolicitationId?: string | null;
    title?: string;
  } = {},
): Promise<string> {
  const approvedBy = opts.sourcingApprovedBy ?? null;
  const outcomeRecordedBy = opts.outcomeRecordedBy ?? null;
  // The is_services_provenance CHECK requires a source whenever is_services is non-null.
  const isServices = opts.isServices === undefined ? null : opts.isServices;
  const [row] = await tx
    .insert(solicitations)
    .values({
      orgId,
      noticeId: `NOTICE-${uniq()}`,
      title: opts.title ?? "Test Solicitation",
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
      outcomeRecordedBy,
      outcomeRecordedAt: outcomeRecordedBy ? new Date() : null,
      awardDate: opts.awardDate ?? null,
      noticeType: (opts.noticeType ?? null) as never,
      rfiTrackStatus: (opts.rfiTrackStatus ?? null) as never,
      convertedFromSolicitationId: opts.convertedFromSolicitationId ?? null,
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

/** A vetted `vendors` row (distinct from a mere `vendor_prospects` row — required for a quote to cascade
 *  into a `contracts` row, whose awarded_vendor_id FK requires a vetted vendor). */
export async function insertVendor(
  tx: Tx,
  orgId: string,
  opts: { companyName?: string; smallBusinessStatus?: string; vettedBy?: string } = {},
): Promise<string> {
  // vendors_vetted_requires_vetter CHECK: a VETTED vendor must carry a recorded vetter + timestamp.
  const vettedBy = opts.vettedBy ?? (await insertUser(tx, orgId, { role: "ADMIN" }));
  const [row] = await tx
    .insert(vendors)
    .values({
      orgId,
      companyName: opts.companyName ?? `Vendor ${uniq()}`,
      contactEmail: `vendor-${uniq()}@example.test`,
      smallBusinessStatus: (opts.smallBusinessStatus ?? "SMALL") as never,
      status: "VETTED",
      vettedBy,
      vettedAt: new Date(),
    })
    .returning({ id: vendors.id });
  return row!.id;
}

/** A quote whose party is a VETTED VENDOR (vendorId set, prospectId null) — the authenticated-submit shape
 *  (Phase-6 PR K), and the only shape draftSubcontract can cascade into a `contracts` row. */
export async function insertVendorQuote(
  tx: Tx,
  orgId: string,
  opts: {
    solicitationId: string;
    vendorId: string;
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
      vendorId: opts.vendorId,
      status: (opts.status ?? "SUBMITTED") as never,
      totalPrice: opts.totalPrice ?? "100000",
      notes: opts.notes ?? null,
    })
    .returning({ id: vendorQuotes.id });
  return row!.id;
}

/** A `proposals` row (the pre-award bid draft). draftSubcontract requires one at status WON with a
 *  selectedQuoteId before it will cascade a contract. */
export async function insertProposal(
  tx: Tx,
  orgId: string,
  opts: {
    solicitationId: string;
    selectedQuoteId?: string | null;
    contractType?: string;
    status?: string;
    submittedBy?: string | null;
    counselReviewedBy?: string | null;
  },
): Promise<string> {
  const submittedBy = opts.submittedBy ?? null;
  const counselReviewedBy = opts.counselReviewedBy ?? null;
  const [row] = await tx
    .insert(proposals)
    .values({
      orgId,
      solicitationId: opts.solicitationId,
      selectedQuoteId: opts.selectedQuoteId ?? null,
      contractType: (opts.contractType ?? "FFP") as never,
      status: (opts.status ?? "DRAFT") as never,
      submittedBy,
      submittedAt: submittedBy ? new Date() : null,
      counselReviewedBy,
      counselReviewedAt: counselReviewedBy ? new Date() : null,
    })
    .returning({ id: proposals.id });
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
