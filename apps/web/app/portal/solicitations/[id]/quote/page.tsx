/**
 * /portal/solicitations/[id]/quote — the LOGGED-IN vendor's quote-submission page (Phase-6 PR K). Unlike
 * the public /quote/[token] page, the authorization is the SESSION (requireVendorWithVendorId), and the
 * solicitation is read under withVendorRole so RLS confines it to the vendor's org. The form renders only
 * for an OPEN RFQ (OPEN_RFQ_STATUSES — the same window the browse page filters on); anything else shows a
 * "not accepting quotes" notice. SAM-sourced title/scope render as data (JSX autoescape).
 */
import type { JSX } from "react";

import { and, eq, solicitations, withVendorRole } from "@hermes/db";

import { requireVendorWithVendorId } from "@/lib/auth-guard";
import { OPEN_RFQ_STATUSES, type SolicitationStatus } from "@/lib/portal";

import { submitQuote } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COST_TYPES = ["LABOR", "MATERIAL", "ODC", "SUBCONTRACT", "TRAVEL"] as const;
const LINE_ITEM_ROWS = [0, 1, 2];

const STATUS_MESSAGE: Record<string, string> = {
  duplicate: "You have already submitted a quote for this RFQ.",
  badfile: "That file was not accepted. Please upload a PDF or DOCX under 25 MB.",
  invalid: "Some required fields were missing or invalid. Please review and resubmit.",
  closed: "This RFQ is no longer accepting quotes.",
  throttled: "Too many attempts. Please wait a minute and try again.",
  error: "Something went wrong saving your quote. Please try again.",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function VendorQuotePage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const { id } = await params;
  const { status } = await searchParams;
  const { session, vendorId } = await requireVendorWithVendorId();
  const orgId = session.user.orgId;

  const sol = await withVendorRole(orgId, vendorId, async (tx) => {
    const rows = await tx
      .select({
        title: solicitations.title,
        agency: solicitations.agency,
        contractType: solicitations.contractType,
        responseDeadline: solicitations.responseDeadline,
        scopeText: solicitations.scopeText,
        status: solicitations.status,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, orgId), eq(solicitations.id, id)))
      .limit(1);
    return rows[0] ?? null;
  });

  if (status === "submitted") {
    return (
      <main>
        <h1>Quote received — thank you</h1>
        <p data-testid="submit-success">
          Your quote has been submitted for review. No further action is needed.
        </p>
      </main>
    );
  }

  const isOpen = sol !== null && OPEN_RFQ_STATUSES.includes(sol.status as SolicitationStatus);

  return (
    <main>
      <h1>Submit a quote</h1>
      {status && STATUS_MESSAGE[status] ? (
        <p role="alert" style={{ color: "#b00" }}>
          {STATUS_MESSAGE[status]}
        </p>
      ) : null}

      {sol ? (
        <section>
          <h2>{sol.title}</h2>
          <p>
            {sol.agency ? `${sol.agency} · ` : ""}
            {sol.contractType ? `Contract type: ${sol.contractType}` : ""}
            {sol.responseDeadline
              ? ` · Response due ${sol.responseDeadline.toISOString().slice(0, 10)}`
              : ""}
          </p>
          {sol.scopeText ? <p style={{ whiteSpace: "pre-wrap" }}>{sol.scopeText}</p> : null}
        </section>
      ) : (
        <p>This solicitation could not be found.</p>
      )}

      {!isOpen ? (
        <p data-testid="rfq-closed">This RFQ is not currently accepting quotes.</p>
      ) : (
        <form action={submitQuote} data-testid="quote-form">
          <input type="hidden" name="solicitationId" value={id} />

          <fieldset>
            <legend>Line items</legend>
            {LINE_ITEM_ROWS.map((i) => (
              <div key={i} style={{ marginBottom: "0.5rem" }}>
                <select name={`costType_${i}`} aria-label={`Cost type ${i + 1}`} defaultValue="LABOR">
                  {COST_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>{" "}
                <input name={`description_${i}`} placeholder="Description" maxLength={500} />{" "}
                <input
                  name={`quantity_${i}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Qty"
                  defaultValue="1"
                />{" "}
                <input
                  name={`unitRate_${i}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unit rate (USD)"
                />
              </div>
            ))}
            <p style={{ fontSize: "0.85rem", color: "#555" }}>
              Enter at least one line item. Leave unused rows blank.
            </p>
          </fieldset>

          <p>
            <label>
              Period of performance:{" "}
              <input name="periodOfPerformance" maxLength={200} placeholder="e.g. 12 months" />
            </label>
          </p>
          <p>
            <label>
              <input type="checkbox" name="payWhenPaid" defaultChecked /> Pay-when-paid terms
              acceptable
            </label>
          </p>
          <p>
            <label>
              Notes:
              <br />
              <textarea name="notes" rows={4} maxLength={5000} />
            </label>
          </p>
          <p>
            <label>
              Quote document (PDF or DOCX, max 25 MB):{" "}
              <input type="file" name="file" accept=".pdf,.docx,application/pdf" required />
            </label>
          </p>

          <button type="submit">Submit quote</button>
        </form>
      )}
    </main>
  );
}
