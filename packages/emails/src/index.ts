/**
 * @hermes/emails — React Email templates (autoescaped) + Resend senders for Hermes 2.0 outbound mail
 * (CLAUDE.md §3/§7). Outreach is sent ONLY after a human approves the campaign; the morning brief is an
 * internal operator digest. Untrusted vendor-derived strings are rendered as escaped React children.
 */
export * from "./types.js";
export { OutreachEmail } from "./templates/OutreachEmail.js";
export { MorningBrief } from "./templates/MorningBrief.js";
export { sendOutreachEmail, sendBriefEmail } from "./send.js";
