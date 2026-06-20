/**
 * /quote/[token] — the PUBLIC, no-account quote-submission page. It is NOT under the /admin|/portal
 * middleware matcher; the signed token IS the authorization. The token is re-verified here (to render)
 * and again in the submitQuote action (to write) — the page never trusts a value the action will rely on.
 */
import type { JSX } from "react";

import { TokenError, verifyToken } from "@hermes/core";
import { and, eq, solicitations, withTokenRole } from "@hermes/db";

import { Card, PublicShell } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

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
        <PublicShell width="narrow">
          <h1>This link is no longer valid</h1>
          <p>
            The invitation link is invalid or has expired. Please contact the requester for a new one.
          </p>
        </PublicShell>
      );
    }
    throw err;
  }

  if (status === "submitted") {
    return (
      <PublicShell width="narrow">
        <h1>Quote received — thank you</h1>
        <p>Your quote has been submitted for review. No further action is needed.</p>
      </PublicShell>
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
    <PublicShell>
      <h1>Submit a quote</h1>
      {status && STATUS_MESSAGE[status] ? <Alert>{STATUS_MESSAGE[status]}</Alert> : null}

      {sol ? (
        <Card>
          <h2 className={c.sectionTitle}>{sol.title}</h2>
          <p className={c.meta}>
            {sol.agency ? `${sol.agency} · ` : ""}
            {sol.contractType ? `Contract type: ${sol.contractType}` : ""}
            {sol.responseDeadline
              ? ` · Response due ${sol.responseDeadline.toISOString().slice(0, 10)}`
              : ""}
          </p>
          {sol.scopeText ? <p className={c.scope}>{sol.scopeText}</p> : null}
        </Card>
      ) : (
        <p className={c.empty}>The associated solicitation could not be found.</p>
      )}

      <form action={submitQuote} className={c.formStack}>
        <input type="hidden" name="token" value={token} />

        <fieldset className={c.fieldset}>
          <legend>Line items</legend>
          {LINE_ITEM_ROWS.map((i) => (
            <div key={i} className={c.lineRow}>
              <select
                name={`costType_${i}`}
                aria-label={`Cost type ${i + 1}`}
                defaultValue="LABOR"
                className={c.control}
              >
                {COST_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
              <input
                name={`description_${i}`}
                placeholder="Description"
                maxLength={500}
                className={c.control}
              />
              <input
                name={`quantity_${i}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Qty"
                defaultValue="1"
                className={c.control}
              />
              <input
                name={`unitRate_${i}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Unit rate (USD)"
                className={c.control}
              />
            </div>
          ))}
          <p className={c.meta}>Enter at least one line item. Leave unused rows blank.</p>
        </fieldset>

        <label>
          <span className={c.formLabel}>Period of performance</span>
          <input
            name="periodOfPerformance"
            maxLength={200}
            placeholder="e.g. 12 months"
            className={c.control}
          />
        </label>

        <label className={c.checkRow}>
          <input type="checkbox" name="payWhenPaid" defaultChecked /> Pay-when-paid terms acceptable
        </label>

        <label>
          <span className={c.formLabel}>Notes</span>
          <textarea name="notes" rows={4} maxLength={5000} className={c.control} />
        </label>

        <label>
          <span className={c.formLabel}>Quote document (PDF or DOCX, max 25 MB)</span>
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,application/pdf"
            required
            className={c.control}
          />
        </label>

        <Button type="submit">Submit quote</Button>
      </form>
    </PublicShell>
  );
}
