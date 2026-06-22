# Live-test runbook — SAM.gov → AI → human gates → safe-stop submit

This walks the BurgerGov console end-to-end against **real SAM.gov opportunities** and **real AI**, with
every human-in-the-loop (HITL) gate intact, the counsel blocker auto-resolved for testing, and the final
"Submit to agency" action a **sandboxed no-op** — no real bid is ever transmitted (CLAUDE.md §2).

## What is real vs. test-gated

| Stage | Behavior in this run |
|---|---|
| 1 — Inquiry (ingest) | **Real.** `ingestSolicitations` queries `api.sam.gov/opportunities/v2/search` by NAICS over a recent posting window. Fails fast if `SAM_API_KEY` is unset (no fake results). |
| 2–5 — triage / sourcing / pricing / proposal | **Real AI** via the Anthropic SDK. Output is advisory, editable, human-overridable. |
| Triage / Sourcing / Pricing gates | **Real HITL.** Operator must click to approve sourcing, approve+send outreach, shortlist, and select a winner. Rendering never mutates state. |
| Approval-detail release | **Real HITL.** 1.5s long-press release gate; an early release dispatches nothing. |
| Counsel review | **Auto-resolved** when `COUNSEL_AUTOFILL=true` (test only) — audited as an autofill, never as a genuine sign-off. |
| Other live blockers (SAM reg / CAGE / actual rates) | **Computed honestly** — they still surface; they are NOT auto-satisfied. |
| Submit to agency | **Sandboxed no-op** when `HERMES_TEST_MODE=true`: logs `BID_SUBMIT_TEST_MODE`, transmits nothing, status unchanged. |

## Required environment

Set these in the **app runtime** (`fly secrets` in prod, gitignored `.env` locally). **Never** `export`
`ANTHROPIC_API_KEY` into the shell that launches Claude Code (CLAUDE.md §4 — billing separation).

```bash
# --- Real data + AI (required) ---
SAM_API_KEY=<your api.sam.gov key>          # ingest FAILS FAST without this — no fake results
ANTHROPIC_API_KEY=<runtime key>             # the Hermes AI engine (per-token billed; app-only)
VOYAGE_API_KEY=<key>                         # embeddings for capability⇄scope matching
HERMES_ACTIVE_ORG_IDS=<seeded org uuid>     # the firm org the crons iterate

# --- Optional ingest tuning ---
SAM_POSTED_WINDOW_DAYS=7                      # posting window (days), clamped 1..365
SAM_SET_ASIDE=                               # comma codes e.g. SBA,SBP; empty = no filter

# --- Test mode (ENABLE for this run; BOTH default OFF) ---
HERMES_TEST_MODE=true                         # sandboxed no-op submit + TEST MODE banner
COUNSEL_AUTOFILL=true                         # auto-resolve counsel gate (only with HERMES_TEST_MODE)
```

**To return to production behavior:** remove `HERMES_TEST_MODE` and `COUNSEL_AUTOFILL` (or set anything
other than `true`). With both off, the submit gate and counsel gate behave byte-for-byte as before.

## Run

1. **Migrate + seed + start.**
   ```bash
   pnpm --filter @hermes/db migrate
   pnpm --filter @hermes/db seed         # seeds only the firm org + admin user (no synthetic opportunities)
   pnpm --filter @hermes/web dev          # or `fly deploy` for the deployed run
   ```
   Resolve the seeded org's UUID and set `HERMES_ACTIVE_ORG_IDS` to it.

2. **Trigger the SAM pull.** Let the `samScan` cron fire, or invoke the ingest from the Inngest dev UI.
   With a valid `SAM_API_KEY` you'll see new `solicitations` rows from real notices (agency, notice number,
   NAICS, response deadline, scope). With no key the job **throws and reports** — it never fakes results.

3. **Walk the gates** in `/admin`:
   - **Solicitations** → open a notice → review the AI triage verdict. Approve sourcing (`approveSourcing`)
     or mark no-go (`markNoGo`). Nothing advances without your click.
   - **Approvals** → review drafted outreach → release via the 1.5s long-press gate to approve+send
     (`approveOutreach`) or reject (`rejectOutreach`). An early release dispatches nothing.
   - Back in the solicitation detail → **shortlist** quotes (`shortlistQuote`) → **select the winner**
     (`selectQuote`). Selecting a winner emits the draft-proposal gate event.
   - **Bid decision-brief** (`/admin/solicitations/[id]/proposal`) → review pricing scenarios + compliance
     + §3 bid checklist.

4. **Resolve counsel + reach ready.** Click **"Auto-resolve counsel review (TEST MODE)"** (DRAFT →
   COUNSEL_REVIEW), then **"Mark ready to submit"** (→ READY_TO_SUBMIT). The TEST MODE banner is visible
   throughout. Any honest blocker (SAM registration, CAGE, actual rates) still appears under
   **Live-submission blockers** — if one would block a real bid, it is shown, not silently bypassed.

5. **Observe the safe stop.** Click **"Submit to agency"**. In test mode this records `BID_SUBMIT_TEST_MODE`
   to the audit trail, transmits nothing, and leaves the proposal in READY_TO_SUBMIT. Confirm in the audit
   log that no `PROPOSAL_SUBMITTED` row was written.

## No-transmission guarantee

There is **no outbound submission code** anywhere in `submitProposal` — even off test mode it can only flip
a DB status after `readyForLiveSubmission` passes (impossible on the provisional baseline), and the two
`proposals` DB CHECKs are the final backstop. Test mode short-circuits to an audited no-op before any gate
evaluation can matter.
