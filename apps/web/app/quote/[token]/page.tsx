/**
 * /quote/[token] — the PUBLIC, no-account quote-submission page. It is NOT under the /admin|/portal
 * middleware matcher; the signed token IS the authorization. The token is re-verified here (to render)
 * and again in the submitQuote action (to write) — the page never trusts a value the action will rely on.
 */
import type { JSX } from "react";

import { TokenError, verifyToken } from "@hermes/core";
import { and, eq, solicitations, withTokenRole } from "@hermes/db";

import { submitQuote } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COST_TYPES = ["LABOR", "MATERIAL", "ODC", "SUBCONTRACT", "TRAVEL"] as const;
const LINE_ITEM_ROWS = [0, 1, 2];

const STATUS_MESSAGE: Record<string, string> = {
  duplicate: "This invitation has already been used to submit a quote.",
  badfile: "That file was not accepted. Please upload a PDF or DOCX under 25 MB.",
  invalid: "Some required fields were missing or invalid. Please review and resubmit.",
  throttled: "Too many attempts. Please wait a minute and try again.",
  error: "Something went wrong saving your quote. Please try again.",
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function QuotePage({ params, searchParams }: PageProps): Promise<JSX.Element> {
  const { token } = await params;
  const { status } = await searchParams;

  let payload;
  try {
    payload = verifyToken(token, "QUOTE_SUBMISSION");
  } catch (err) {
    if (err instanceof TokenError) {
      return (
        <main>
          <h1>This link is no longer valid</h1>
          <p>
            The invitation link is invalid or has expired. Please contact the requester for a new one.
          </p>
        </main>
      );
    }
    throw err;
  }

  if (status === "submitted") {
    return (
      <main>
        <h1>Quote received — thank you</h1>
        <p>Your quote has been submitted for review. No further action is needed.</p>
      </main>
    );
  }

  const sol = await withTokenRole(payload.org, async (tx) => {
    const rows = await tx
      .select({
        title: solicitations.title,
        agency: solicitations.agency,
        contractType: solicitations.contractType,
        responseDeadline: solicitations.responseDeadline,
        scopeText: solicitations.scopeText,
      })
      .from(solicitations)
      .where(and(eq(solicitations.orgId, payload.org), eq(solicitations.id, payload.sol ?? "")))
      .limit(1);
    return rows[0] ?? null;
  });

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
        <p>The associated solicitation could not be found.</p>
      )}

      <form action={submitQuote}>
        <input type="hidden" name="token" value={token} />

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
            <input type="checkbox" name="payWhenPaid" defaultChecked /> Pay-when-paid terms acceptable
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
    </main>
  );
}
