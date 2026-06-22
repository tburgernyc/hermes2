/**
 * Live-test mode flags (CLAUDE.md §2 — the Prime Directive). BOTH default OFF; production sets neither,
 * so the submit gate and counsel gate behave exactly as before. These exist solely so the operator can
 * exercise the full SAM.gov → AI → human-gate pipeline end-to-end without (a) a real external-counsel
 * sign-off and (b) ever transmitting a real bid.
 *
 *   HERMES_TEST_MODE=true  → "Submit to agency" becomes a sandboxed, AUDITED NO-OP — it never transmits
 *                            anything (there is no outbound code to begin with) and never advances the
 *                            proposal to SUBMITTED. The proposal surface shows a TEST MODE banner.
 *   COUNSEL_AUTOFILL=true  → only effective WHEN HERMES_TEST_MODE is also on (defense in depth: counsel
 *                            can never be auto-resolved in production). Auto-resolves the counsel gate from
 *                            the provisional baseline so the workflow can reach READY_TO_SUBMIT without a
 *                            real counsel review. Every OTHER live-submission blocker (SAM registration,
 *                            CAGE, actual indirect rates) still computes honestly and is surfaced.
 */

/** True when the no-real-submission test override is active (HERMES_TEST_MODE=true). */
export function isSubmitTestMode(): boolean {
  return process.env.HERMES_TEST_MODE === "true";
}

/**
 * True when counsel autofill is active. Requires the master test flag to also be on, so a stray
 * COUNSEL_AUTOFILL in a production environment can never lift the real counsel gate on its own.
 */
export function isCounselAutofill(): boolean {
  return process.env.COUNSEL_AUTOFILL === "true" && isSubmitTestMode();
}
