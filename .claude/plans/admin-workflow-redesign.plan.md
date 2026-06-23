# Plan: Real-World Admin Execution Workflow (BurgerGov console re-architecture)

**Source**: free-form operator brief (2026-06-22), branch `burgergov-ui`
**Complexity**: Large (multi-phase program; 7 delivery phases, each one-PR/one-green-CI per CLAUDE.md §8)
**Status**: AWAITING CONFIRMATION — no code until approved.

---

## 1. What you asked for (restated as a 15-stage execution model)

| # | Stage | Actor |
|---|---|---|
| 1 | SAM.gov search → opportunities that fit criteria, with full info + AI pursue rec | AI |
| 2 | Decide to pursue | **Human gate** |
| 3 | Source + vet candidate subcontractors; present ranked 0–100 | AI (NEW capability) |
| 4 | Pick candidates; draft RFP emails (who we are, scope, ask for proposal) | Human + AI |
| 5 | Choose who to email; send RFP w/ portal login token | **Human gate** |
| 6 | On each proposal received: notify admin; AI audits + scores | AI (advisory) |
| 7 | At the submission due date: close intake; rank; pull prior-contract intel (pricing, CO name/contact) | AI (NEW) |
| 8 | Present ranked proposals, best-on-top, with per-rank rationale | AI (advisory) |
| 9 | Choose winner → AI drafts the actual bid | Human + AI |
| 10 | Notify for review → review the draft bid | **Human gate** |
| 11 | Approve → submit the bid to SAM.gov | **Human gate** ⚠️ see §2 |
| 12 | On award: notify admin (AI reads company inbox for win/CO/sub mail) | AI (advisory) ⚠️ |
| 13 | On award: AI drafts Burger↔sub subcontract (SOW/payment); admin review/edit | AI + Human |
| 14 | Approve → send to sub dashboard for signature; email sub (win + contract-ready, portal link) | **Human gate** ⚠️ |
| 15 | On sub signature: notify admin; sub picks kickoff slot; AI builds kickoff packet | AI + sub self-serve |

---

## 2. THREE HARD CONSTRAINTS (read first — these reshape stages 11, 12, 14)

This system's whole product identity is the **Prime Directive (§2): the AI never takes an outbound or
state-advancing action on its own.** Three parts of the brief cross that line (two also cross §6.6, the
False-Claims-Act / human-signature rule). None of them block the vision — they change *who clicks the
final button*, not what gets built.

### 2A. "AI submits the proposal to SAM.gov" → **Assisted submission, never autonomous** ⚠️ HARD
- **§6.6 + FCA:** every pre-filled field in a federal bid is a legal statement; the human must sign and
  submit. No auto-sign, no auto-submit. This is structurally enforced today (`proposals` CHECKs +
  `readyForLiveSubmission`); `submitProposal()` is a no-op on the provisional baseline.
- **Also technically true:** SAM.gov has **no public API to submit a contract-opportunity response.**
  Responses are uploaded by a human through the SAM.gov UI, or emailed to the Contracting Officer per the
  solicitation's instructions. There is nothing to call.
- **What we build instead (Stage 11):** the system assembles the **final, signature-ready package +
  a transmission checklist**; if the solicitation accepts CO-email submission, the AI *drafts* that email
  and it goes out **only through the existing human approval gate**; the human performs the actual
  SAM.gov upload / send and **records the confirmation**. `submitProposal` records the event; it never
  transmits autonomously.

### 2B. "Give the AI access to t.burger@burgergov.com" → **Read = yes (advisory). Send = human-gated.** ⚠️
- **Reading** the inbox to detect award notices and capture CO/sub correspondence is advisory ingestion —
  fully compliant. The AI classifies + extracts + surfaces to you; it never acts on what it reads.
- **Sending** from that inbox autonomously is a §2 violation. Every outbound email (RFP, win notice,
  contract-ready) goes through the **same approval gate that already governs outreach**: AI drafts →
  you approve → system sends. That gate is the core of the product; we extend it, we don't bypass it.

### 2C. "AI generates the subcontract and sends it for signature" → **AI drafts; humans sign/approve** ⚠️
- The Burger↔sub subcontract is a **commercial** agreement (not a government submission), so AI drafting
  is fine. But **Burger's signature is a human act**, and **sending it to the sub for signature is a
  human-approved action** (same gate). The AI assembles the draft and the package; it never binds the
  firm.

> If you're OK with these three reframings (assisted-submit, read-only inbox + gated send, AI-drafts/
> human-signs), the entire vision is buildable with the existing safety architecture intact. If you want
> the AI to *actually auto-submit or auto-send*, that's a different product and I'd stop and flag it —
> it would also fail the counsel sign-off in §0/§6.

---

## 3. Research findings (the explicit ask)

### 3A. Requirements to engage a subcontractor on NAICS 541511/541512/541519 work
- **Burger is a *small* business prime → NO FAR 52.219-9 subcontracting plan required.** Subcontracting
  plans are required only of *other-than-small* primes on contracts over ~$750K–$900K. This **simplifies**
  the build — we don't need a subcontracting-plan module.
- **What does govern us:** **FAR 52.219-14 Limitations on Subcontracting** + **13 CFR 125.6** (the 50%
  rule / similarly-situated math) — **already implemented** deterministically (`compliance.ts`).
- **A subcontractor must be:** (a) registered + **active in SAM.gov**; (b) **not excluded/debarred**
  (SAM.gov Exclusions — a hard gate, you cannot subcontract to a debarred entity); (c) for the 50%/
  similarly-situated math, **small under the subcontract's NAICS** (size standard for NAICS 541511 ≈
  $25.5M revenue). All three are checkable via SAM.gov APIs.
- **Engaging a sub is a commercial sequence, no government permission needed:** NDA → (optional) teaming
  agreement pre-award → subcontract agreement post-award.

### 3B. Where to find qualified IT subcontractors (depth + automatability)
| Source | Depth | API? | Use in plan |
|---|---|---|---|
| **SAM.gov Entity Management API** | High — every registered entity by NAICS/UEI/CAGE/size/POC + **Exclusions** | ✅ official free API | **Primary automated pull + the exclusion gate** |
| **USASpending.gov API** | High — who actually *won/performed* similar NAICS work, $, agency, **prior pricing + incumbent/CO signal** | ✅ official free API (already used for pricing) | **Past-performance qualification + Stage-7 prior-contract intel** |
| **SBA Small Business Search** (SBS — replaced DSBS 2025-07-09) | High for small/socioeconomic + skillset keywords | ⚠️ portal, limited API | Human-assisted lookup surfaced in UI |
| **GSA eLibrary** | Medium — MAS schedule holders by NAICS/SIN | ⚠️ semi | Human-assisted lookup |
| **FPDS** | High — 50M+ contract records | ⚠️ semi | Human-assisted lookup |
| Manual / referral / **existing tokenized public submission** | — | n/a | Keep as inputs (`prospect_source` already supports MANUAL/REFERRAL/TOKENIZED) |

**Recommendation:** automate the two real APIs (**SAM Entity + USASpending**) as the discovery engine;
surface SBS/eLibrary/FPDS as one-click human-assisted lookups; keep manual/referral/tokenized inputs. This
finally populates the `prospect_source=DISCOVERY` path and **wires up the dormant pgvector capability↔scope
semantic match** (the embeddings column exists but is never queried today).

---

## 4. The UX problem ("not intuitive") — root cause + fix

Today the work is scattered across parallel pages (kanban board, separate Approvals, Prospects, Vendors,
per-solicitation detail + proposal). The operator has to *assemble* the workflow in their head. The fix is
a **per-solicitation linear "pipeline" view** that mirrors the 15-stage model: one screen per opportunity
that shows *where it is*, *what the AI produced*, and *the single decision you owe right now*, plus a global
**"Needs your decision" queue** on the dashboard. No state-machine change — a presentation layer over the
existing actions. This is Phase A and ships first.

---

## 5. Delivery phases (each = one PR = one green CI gate; §8)

| Phase | Title | New capability? | §2 surface | Depends on |
|---|---|---|---|---|
| **A** | **Console workflow re-architecture** (per-solicitation pipeline view + "Needs your decision" queue) | No — pure UX over existing actions | none | — |
| **B** | **Subcontractor sourcing engine** (SAM Entity + USASpending connectors → pre-vet/exclusion gate → pgvector match → 0–100 rank) | Yes | read-only external fetch (SSRF-guarded) | A |
| **C** | **On-receipt scoring + notifications + deadline-close** (per-solicitation due date; auto-close intake; score-on-receipt; prior-contract intel on ranking screen) | Yes | advisory only | A, B |
| **D** | **Inbound email ingestion** (company inbox → classify award/CO/sub mail → surface; human confirms award) | Yes | **read-only**, advisory | A |
| **E** | **Assisted final submission** (final-package assembler + transmission checklist + draft CO-email through the gate + record confirmation) | Reframe of `submitProposal` | human-gated | A |
| **F** | **Subcontract generation + e-signature** (AI drafts Burger↔sub subcontract → admin edit → human sign → e-sign send → capture; wires `contracts`/`esignStatus`) | Yes | human-gated | A, D |
| **G** | **Award/contract-ready emails + kickoff scheduling** (gated sub notifications w/ portal link; sub self-serve calendar slot; AI kickoff packet) | Yes | human-gated send + sub self-serve | F |

Recommended order: **A → B → C → D → E → F → G** (UX value first; legal-surface phases E/F/G last and each
behind counsel-relevant gates). Phases are independently shippable; B and D can parallelize after A.

---

## 6. Per-phase sketch (files/patterns to mirror — detail expands at each phase's own /plan)

- **A:** new `apps/web/app/admin/(console)/solicitations/[id]/pipeline/` view + a `lib/pipeline.ts` stage
  model (mirror `lib/admin-board.ts`); dashboard "Needs your decision" panel from existing morning-brief
  queries. Reuses every existing server action. No DB, no AI, no Inngest change.
- **B:** new `packages/integrations/` (or extend `packages/inngest/logic.ts`) SAM-Entity + USASpending
  fetchers behind the existing `safeFetchDocument` SSRF guard + host allowlist; a deterministic pre-vet
  (SAM-active + **exclusion = hard block** + size + NAICS); connect `embed.ts` → pgvector cosine query
  (the index already exists); `prospect_source=DISCOVERY` rows; new Inngest `sourceSubcontractorsFn`
  triggered off `hermes/sourcing.approved` (or a manual "Find subcontractors" action). Outreach still gated.
- **C:** `solicitations.submission_deadline` column + a deadline-close Inngest step (deterministic status
  flip, **not** model-scored); on-receipt scoring hook in the quote path; `award_intelligence` enrichment
  (USASpending) surfaced on the ranking screen. Notifications = morning-brief items + optional gated email.
- **D:** `packages/integrations/inbox` (Gmail API via company OAuth, **or** Resend-inbound webhook —
  decision below) → classifier (advisory) → `inbound_messages` table → surfaced in console; "Confirm award"
  is a human action that sets `AWARDED`. Secrets in `fly secrets` (§4), never the Claude Code shell.
- **E:** reframe `submitProposal` into `assembleFinalPackage` + `recordSubmission`; DOCX/PDF via the
  existing code-execution export path; keep `readyForLiveSubmission` + counsel CHECKs.
- **F:** AI subcontract draft (new `packages/ai` fn, prose-only) → `contracts` row PENDING_SIGNATURE →
  human Burger-sign → e-sign send → `esignStatus` lifecycle → ACTIVE. E-sign provider decision below.
- **G:** gated sub emails (extend `packages/emails` + the outreach gate pattern); sub self-serve calendar
  (Google Calendar via company OAuth or a scheduling table); AI kickoff packet (prose-only).

---

## 7. Decisions (operator-confirmed 2026-06-22)

1. **Build order → Phase B (sourcing engine) FIRST.** UX re-architecture (A) follows. B is self-contained
   and delivers the most-wanted new capability; the existing scattered console stays usable in the interim.
2. **Inbox (Phase D) → company email is on Zoho Mail (`zohomail.com`), NOT Google.** Use the **Zoho Mail
   REST API + OAuth** (read-only scopes) — same advisory-read / human-gated-send design as the Gmail plan,
   different provider/SDK. (Zoho also offers IMAP as a fallback.)
3. **E-signature (Phase F) → integrate a provider; choice = Dropbox Sign** (formerly HelloSign): simplest
   REST API, ESIGN/UETA-compliant, built-in audit trail, lighter than DocuSign.
4. **Assisted-submit (Phase E) → CONFIRMED.** Human performs the final SAM.gov submission/signature; the
   system assembles the signature-ready package + checklist + records confirmation. No autonomous transmit.

---

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| §2 / §6.6 erosion if any "AI sends/submits" slips in | High if unguarded | All outbound through the existing approval gate; submit stays human; counsel sign-off (§0) still blocks live bids |
| External APIs (SAM Entity / USASpending) rate limits, schema drift, SSRF | Medium | Reuse `safeFetchDocument` guard + allowlist; cache; fail-closed; idempotent jobs |
| Inbox access = new PII/secret surface (§4, §7) | Medium | OAuth scopes minimal + read-only; secrets in `fly secrets`; Sentry PII scrub already drops emails |
| E-sign legal validity (ESIGN/UETA) | Medium | Use a compliant provider; counsel review of the subcontract template |
| Scope creep — this is 7 phases | High | One PR per phase, green CI gate, update §11 + memory each phase; re-/plan at each phase boundary |
| Sourcing surfaces a debarred/ineligible sub | Low but severe | Exclusion check is a **hard block** in pre-vet, not advisory |

## 9. Acceptance (program-level)
- [ ] Each phase ships as its own PR behind green CI; §11 + memory updated per phase.
- [ ] Prime Directive §2 intact: no autonomous outbound/submit/sign anywhere; every gate human or deterministic.
- [ ] Counsel sign-off (§0/§6) still structurally blocks any live bid (`readyForLiveSubmission`).
- [ ] The console presents the workflow as one intuitive per-solicitation pipeline + a single decision queue.

---

## 10. Phase B — Subcontractor sourcing engine (FIRST DELIVERABLE — detailed plan)

**Goal:** for a solicitation the operator has approved for sourcing, automatically **discover, pre-vet, and
0–100-rank** candidate subcontractors from real federal data — finally populating the `prospect_source=
DISCOVERY` path and lighting up the dormant pgvector capability↔scope match. **Outreach stays fully gated**
(§2): B produces *candidates + scores*, never a send.

### B.1 External connectors (read-only, SSRF-guarded — reuse `safeFetchDocument` + host allowlist)
- **SAM.gov Entity Management API** (`api.sam.gov/entity-information/v3/entities`): search registered
  entities by NAICS (541511/541512/541519); pull legal name, UEI, CAGE, POC email, address, registration
  status, small-business status/size, and **exclusion flag**. Uses `SAM_API_KEY` (already a Fly secret for
  opportunities ingest). **Verify at impl:** (a) the key has Entity-API entitlement (separate from
  Opportunities); (b) `api.sam.gov` is in the SSRF host allowlist (it is, for opportunities).
- **SAM.gov Exclusions** (debarment): from the entity record's exclusion flag and/or the exclusions
  endpoint → **hard block** (an excluded entity is never surfaced as a candidate).
- **USASpending API** (`api.usaspending.gov`, already allowlisted + used for pricing): query awards by
  recipient + NAICS → past-performance signal (award count, $ total, agencies) for qualification scoring.

### B.2 Pre-vet (deterministic, fail-closed — never model-scored)
A candidate must pass ALL to be surfaced: (1) **active** SAM registration; (2) **no exclusion** (hard
block); (3) small under the subcontract NAICS (size signal for the 52.219-14 math); (4) NAICS overlap with
the solicitation. Failures are dropped or flagged, never silently passed.

### B.3 Semantic match (wire the dormant pgvector)
Ingest each discovered entity as a `vendor_prospects` row (`prospect_source=DISCOVERY`), derive
`capabilitiesText` from its SAM entity data (NAICS + PSC + business types + any reported capability text),
embed it via `embed.ts` (Voyage, dim must equal `EMBED_DIM`), then **cosine-rank against the embedded
solicitation scope** using the existing `vendor_prospects_cap_vec_idx`. This is the first live query of
that index.

### B.4 0–100 scoring (advisory, existing AI fn)
Reuse `scoreProspect(solicitationScope, prospectCapability)` → score 1–100 + capabilityMatch +
strengths/gaps + recommendation (already surfaced on the console). Deterministic signals (past-performance,
size, NAICS, vet flags) shown alongside; AI score does not gate anything.

### B.5 Inngest orchestration
New `sourceSubcontractorsFn` triggered either off the existing `hermes/sourcing.approved` event (auto, right
before the current `onSourcingApproved` scoring) **or** a manual "Find subcontractors" admin action emitting
a new `hermes/subcontractors.requested` event. Idempotent: dedupe on UEI / `contact_email` per org (the
existing case-insensitive unique index backstops it). Fail-closed on connector/AI errors (no partial rows
that misrepresent a candidate as vetted).

### B.6 UI
Surface discovered → pre-vetted → ranked candidates on the sourcing screen: 0–100 score, capability %,
strengths/gaps, past-performance, UEI/CAGE, and the deterministic vet flags (active / size / exclusion-clear
/ NAICS). The operator selects which candidates to draft outreach to — **the existing, already-gated path**.

### B.7 Tests (ship with the PR; §8)
- Connector units (mocked fetch): SSRF guard honored; **exclusion ⇒ hard block**; malformed/empty response
  ⇒ fail-closed; NAICS/size parsing.
- pgvector cosine query test (real DB) over seeded prospect embeddings.
- DB negative: DISCOVERY write respects org RLS + dedupe; a discovery row cannot overwrite a vetted vendor.
- Inngest logic test (DB-backed, mocked AI + fetch): discovery → pre-vet → score → DISCOVERY prospects
  created; excluded entity absent; idempotent re-run.

### B.8 Invariants preserved
§2 (no outbound — candidates only; outreach still gated) · §4 (`SAM_API_KEY`/`ANTHROPIC_API_KEY`/
`VOYAGE_API_KEY` in Fly, never the Claude Code shell) · §7 (SSRF guard + allowlist; exclusion hard gate;
audit the discovery write) · fail-closed everywhere.

> **Next step after approval:** I re-run `/plan` scoped to Phase B to expand B into the concrete file/diff
> task list (mirroring `logic.ts` + the existing connector/test patterns), then implement as one PR → green
> CI → update §11 + memory.

**WAITING FOR CONFIRMATION** — say "proceed with Phase B" to start, or tell me what to adjust.
