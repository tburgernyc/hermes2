/**
 * Resend senders. Render the React Email templates to autoescaped HTML + a plain-text alternative, then
 * dispatch via Resend. The client is lazy (RESEND_API_KEY is read at send time, never at import) so the
 * package stays importable without secrets — mirrors @hermes/db's getDb() and @hermes/ai's getAnthropic().
 */
import { render } from "@react-email/render";
import { Resend } from "resend";

import { OutreachEmail } from "./templates/OutreachEmail.js";
import { MorningBrief } from "./templates/MorningBrief.js";
import type { MorningBriefInput, OutreachEmailInput } from "./types.js";

const DEFAULT_FROM = "Burger Consulting <opportunities@burgergov.com>";

let resendSingleton: Resend | undefined;
function getResend(): Resend {
  if (!resendSingleton) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not configured.");
    resendSingleton = new Resend(key);
  }
  return resendSingleton;
}

function fromAddress(): string {
  return process.env.OUTREACH_FROM ?? DEFAULT_FROM;
}

/** Send the (already human-approved) subcontractor outreach email. Returns the Resend message id. */
export async function sendOutreachEmail(input: OutreachEmailInput): Promise<{ id?: string }> {
  const html = await render(<OutreachEmail {...input} />);
  const text = await render(<OutreachEmail {...input} />, { plainText: true });
  const { data, error } = await getResend().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    html,
    text,
  });
  if (error) throw new Error(`Resend outreach send failed: ${error.message}`);
  return { id: data?.id };
}

/** Send the operator's internal morning brief. */
export async function sendBriefEmail(input: MorningBriefInput): Promise<{ id?: string }> {
  const html = await render(<MorningBrief {...input} />);
  const text = await render(<MorningBrief {...input} />, { plainText: true });
  const { data, error } = await getResend().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `${input.orgName} — morning brief (${input.dateLabel})`,
    html,
    text,
  });
  if (error) throw new Error(`Resend brief send failed: ${error.message}`);
  return { id: data?.id };
}
