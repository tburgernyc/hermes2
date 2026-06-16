# Hermes 2.0 — Compliance & Pricing Configuration Brief (Counsel Draft)

> **STATUS: AI-PREPARED DRAFT — NOT LEGAL ADVICE — `pendingCounsel: true` on every item.**
> This document was assembled by Claude Code by researching current public FAR/SBA primary sources
> (acquisition.gov, eCFR/Cornell LII, SBA 13 CFR, USC, USASpending) on **2026-06-15** and formatting the
> answers as the firm's government-contracts counsel would. It is a **starting point for a licensed
> government-contracts attorney to confirm, correct, and adopt** — it does not replace that review, and per
> CLAUDE.md §6 every rule below stays `pendingCounsel: true` until the firm's attorney signs off (sign-off
> block at the end). Each numeric threshold was independently re-verified against primary sources; the
> corrections that produced are folded in below.
>
> **Firm:** Burger Consulting LLC — small federal IT-services contractor. Primary NAICS **541511 / 541512 /
> 541519**. Holds **no** socio-economic certifications. Pursues **Total Small Business set-asides +
> unrestricted/full-and-open**. Contract types: **FFP, T&M, FFP-with-milestones**. Subcontracts to other
> small firms.

---

## ⚠️ Standing caveat — the FAR is mid-overhaul (read before relying on any citation)

The **Revolutionary FAR Overhaul (RFO), EO 14275 (April 2025)** is actively deviating and renumbering the FAR
through 2025–2026 via **agency class deviations** (e.g., DoD/DPCAP class deviations effective 16 Mar 2026;
GSA RFO-2025-xx; DOE PF flashes). Consequences relevant here:

- Some clauses are **renumbered** in the RFO model text — e.g., **unbalanced pricing → 15.404-6**, Section L/M
  instructions/eval factors → **15.109-4(b)/(c)**, cost realism possibly → a standalone 15.404-3.
- Others are **retained one-for-one** — e.g., **FAR Part 31** cost principles (incl. **31.203**), and the
  pass-through clauses **52.215-22 / 52.215-23**.
- **Whether a given solicitation uses the codified FAR or an agency RFO deviation depends on the issuing
  agency and the bid date.** Therefore the compliance engine must key its checklist off **the actual
  solicitation's Section L/M and clause list as issued**, never a hard-coded FAR section number, and **counsel
  must confirm the governing version for each bid.** All citations below are the codified-FAR baseline.

---

## 1. Compliance thresholds — encode as *deterministic* guards (never model-scored)

### 1.1 Limitations on Subcontracting — FAR 52.219-14 / 13 CFR 125.6  ·  **BLOCK** · *the load-bearing rule*

- **Rule:** On a small-business (incl. Total Small Business) set-aside for **services** (except construction)
  above the SAT, the prime **may not pay more than 50% of the amount paid by the Government** to
  subcontractors that are **not** "similarly situated entities."
- **"Similarly situated entity"** (FAR 52.219-14**(b)** [def] / 13 CFR 125.1, 125.6) = a **first-tier**
  subcontractor (**including a 1099 independent contractor**) that **(a)** holds the **same** small-business
  program status that qualified the prime (for a plain small-business set-aside: **any** small business), and
  **(b)** is **small under the NAICS the prime assigns to that subcontract** (which need not be the
  solicitation NAICS). Amounts paid to a similarly-situated sub are **excluded** from the cap **only to the
  extent that sub self-performs with its own employees**; whatever it **further subcontracts counts back**
  toward the prime's cap. **Leased/PEO/temp-agency labor = prime self-performance** (13 CFR 125.6(d)(3)).
- **In-force value:** cap = **50%** of the amount paid by the Government for the **services portion**.
  **Trigger SAT = $350,000** (raised from $250,000 effective **Oct 1, 2025**, FAC 2025-06 / FAR Case 2024-001
  — *this corrected the original $250k figure*). Clause date **52.219-14 (OCT 2022)**; statute **15 USC 657s**.
- **Config:** for `setAside ∈ {TOTAL_SMALL_BUSINESS, partial}` **AND** services **AND** value `> $350,000`:
  track `similarlySituated` per first-tier sub; compute
  `nonSimilarlySituatedShare = Σ(payments to non-similarly-situated subs + the portion a similarly-situated
  sub further subcontracts out) ÷ governmentPaymentForServices`. **`> 0.50` → BLOCK** the set-aside services
  bid; **`> 0.45` → WARN** (approaching cap). Maps to schema: `proposals.government_payment_basis` (denom),
  `proposals.non_similarly_situated_subs_total` (numerator), `vendor_quote_line_items.similarly_situated` +
  `sub_small_business_status` + `sub_subcontract_naics`.
- **Do NOT** implement the obsolete "50% must be the prime's W-2 employees" rule (the RFO summary text still
  surfaces legacy "own employees" phrasing — it is **not** the operative test).
- **For the firm:** *favorable* — because it holds no socio-economic certs, on a plain small-business
  set-aside **any** small first-tier sub is "similarly situated," so heavy subcontracting to small firms is
  compliant as long as **non-similarly-situated (e.g., large-business) sub spend stays ≤ 50%**. Cap does
  **not** apply to unrestricted/full-and-open.
- **Counsel confirm:** the SAT trigger value at bid date; that "amount paid by the Government" (not total
  cost) is the correct denominator for FFP/T&M/milestone; per-subcontract NAICS capture.

### 1.2 Fee / margin + T&M cost treatment — FAR 16.601, 52.232-7, 52.212-4 Alt I  ·  **BLOCK** (T&M lock)

- **FFP:** **no statutory profit/margin cap** — do **not** hard-cap FFP margin (the low-margin flag is only a
  product heuristic, §1.5). Negotiated (non-competitive) actions still get weighted-guidelines profit
  analysis (FAR 15.404-4) — a constraint, not a cap.
- **T&M:** profit is recovered **only** inside the **fully-burdened hourly labor rates**. **Materials,
  subcontracts, ODC, and TRAVEL are reimbursed at cost with 0% fee/markup.** This **resolves the held
  `far-04` question:** FAR **16.601**'s definition of "materials" *expressly includes* "**Other direct costs
  (e.g., … travel, computer usage charges, etc.)**," so **ODC and TRAVEL get the same 0%-fee treatment as
  direct materials and subcontracts.** FAR **52.232-7(b)(7)**: "the Government will not pay profit or fee … on
  materials." The **only** legitimate add-on to materials is a **disclosed indirect material-handling/G&A
  allocation** (FAR 31.2) — an accounting allocation, **not** a percentage profit markup.
- **Config:** `contractType = TM` → lock `markupPct = 0` for **all** `cost_type ∈ {MATERIAL, SUBCONTRACT,
  ODC, TRAVEL}` (extends the existing schema CHECK, which currently locks MATERIAL/SUBCONTRACT, to ODC +
  TRAVEL — **counsel to confirm before the schema CHECK is widened**). Profit lives only in `unit_rate` for
  LABOR. Optional `materialHandlingIndirectPct` (default **0 / OFF**, gated behind a flag, labeled "indirect
  allocation per FAR 31.2, NOT fee") — enable only if the firm's accounting actually has a disclosed
  material-handling rate (most very small firms do not). Commercial-T&M benchmark profit-in-rate ≈ **10%**
  (52.212-4 Alt I) — *benchmark only; supply the firm's actual loaded rate.*
- **For the firm:** the bid-drafter's pricing-math reconciliation must **hard-BLOCK** any T&M line where a
  material/sub/ODC/travel cost carries non-zero markup (a self-inflicted invoice-disallowance / False Claims
  exposure).

### 1.3 Truthful Cost or Pricing Data (TINA) — FAR 15.403-4 / 41 USC 3502 / 10 USC 3702  ·  **WARN/flag**

- **Rule:** certified cost or pricing data is required above the threshold **unless** a FAR 15.403-1(b)
  exception applies — the key one being **adequate price competition (15.403-1(c)(1))**, which is the norm for
  competitive set-asides and full-and-open buys (≥2 responsible independent priced offers; price a substantial
  factor; winning price not unreasonable). So TINA **rarely fires** for this firm.
- **In-force value:** **civilian/FAR-operative threshold = $2.5M** (FAR 15.403-4(a)(1); $950k before 7/1/2018)
  — the correct default for this civilian-leaning firm. **Defense: $10M for defense contracts entered into
  *after* June 30, 2026** (FY2026 NDAA amending 10 USC 3702; statute base is $2.0M). **No certified data at or
  below the SAT** (15.403-1(a)). *Statute-vs-FAR gap:* the $10M is a statutory change; FAR 15.403-4 still
  codifies $2.5M and must be conformed before $10M governs CO practice — **$2.5M remains operative for
  civilian work now.**
- **Config:** `tina.civilianThreshold = 2_500_000`; `tina.defenseThreshold = 2_500_000`, with a date rule
  (DoD **AND** `awardDate > 2026-06-30` → `10_000_000`); `tina.satFloor` wired to the SAT constant. **Flag
  only when** value `> applicableThreshold` **AND NOT** `adequatePriceCompetition`. Default
  `adequatePriceCompetition = true` for any competitive solicitation (maps to
  `proposals.adequate_price_competition`). **WARN, never BLOCK.**
- **Counsel confirm:** the civilian effective number at bid date; the competition-exception conditions; that
  modifications can independently cross the threshold; FY26 NDAA §812's possible revision to the competition
  definition.

### 1.4 Excessive Pass-Through Charges — FAR 52.215-22 / 52.215-23 / 15.408(n)  ·  **WARN** (disclosure gate)

- **Rule:** the Government won't pay indirect costs/profit on subcontracted work where the prime adds **no or
  negligible value**. The **prohibition has no percentage** (a CO judgment). **70%** is a real **disclosure /
  notification tripwire**, *not* the prohibition: the **offeror** must disclose self-performed vs per-sub
  cost and, if subcontracting **>70% of total cost of work**, identify the indirect+fee on the subcontracted
  scope and **describe its added value** (52.215-22); the **contractor** must notify the CO post-award if it
  later exceeds 70% (52.215-23).
- **Applicability (load-bearing):** civilian — clause attaches when value **> SAT ($350,000)** **AND** the
  contract is **cost-reimbursement** (FAR 15.408(n)(2)(i)(A)); DoD — value **>** the cost-or-pricing-data
  threshold AND not exempt FFP/commercial. **The clause generally does NOT attach to the firm's typical
  FFP-competitive / commercial-item set-aside work** → for most of the pipeline this is **advisory**.
- **Config:** `passThroughDisclosureThresholdPct = 70`; when `projectedSubcontractShare > 70%` of
  `proposals.total_cost_of_work` → raise `PASS_THROUGH_DISCLOSURE`, require the operator to populate the
  52.215-22 fields + author an **added-value justification** (`proposals.pass_through_justification`).
  Scope-guard: only assert clause applicability for cost-reimbursement (or value-relevant) contracts; advisory
  otherwise. **WARN, not BLOCK.** **Keep DISTINCT from §1.1** (different test, different consequence —
  219-14 can disqualify; 215-23 governs markup recovery).
- **Counsel confirm:** clause presence in each specific solicitation (read Section I / clause matrix); the
  SAT/TINA trigger values at bid date.

### 1.5 Price realism / buy-in — FAR 15.404-1(d) / 3.501  ·  **WARN only** (product heuristic, *not* a legal rule)

- **Rule:** **no statutory/regulatory minimum margin** for FFP. A low-, zero-, or below-cost FFP bid is
  lawful (offeror bears the risk). Cost-realism adjustment is mandatory only on **cost-reimbursement**
  contracts; **price realism on FFP** may be done **only if the solicitation gives notice**, and the price
  **may not be adjusted**. "Buying-in" (3.501) is **discouraged but not prohibited** — the CO acts to prevent
  *recovery* of buy-in losses, not to reject the low offer.
- **Config:** `{ realismWarningMarginPct: 0.05, severity: "WARN", isLegalRule: false, isHeuristic: true,
  pendingCounsel: true }`. Flag FFP/milestone net margin `< 5%` (and flag `≤ 0%` separately, *informational*).
  **Never** block / gate / auto-set `NO_GO`. UI copy: "Low-margin advisory (heuristic) — the bid may proceed."
  The Section L/M parser should **detect any "price realism" notice** in the RFP and elevate the advisory.
- **Counsel confirm:** the heuristic labeling; the realism-vs-reasonableness distinction.

### 1.6 Size standard & set-aside eligibility — 13 CFR 121.201  ·  **BLOCK** (never self-represent a cert)

- **Rule:** the firm is "small" if its **5-year average annual receipts ≤** the SBA standard for the **CO's
  assigned NAICS** (the averaging period is **5 years**, not 3 — 13 CFR 121.104(c), per the Small Business
  Runway Extension Act of 2018, eff. Jan 6 2020; see §6.1 for the exact formula + affiliation rules).
  **541511 / 541512 / 541519 = $34.0 million** (13 CFR 121.201, eff. 2023-03-17). Size is
  **self-certified at time of offer** (13 CFR 121.404/121.405) — no advance SBA certificate needed for a TSB
  set-aside or unrestricted. **8(a) / HUBZone / SDVOSB / WOSB / EDWOSB are *formal certifications*** — a firm
  that holds none **must never represent** it holds them. 541519 has a 150-employee **ITVAR** exception
  (footnote 18) that applies *only* when the CO assigns it (rarely relevant to custom-programming work).
- **Config:** `SIZE_STANDARD_RECEIPTS_USD = 34_000_000` for `{541511,541512,541519}`,
  `size_basis = RECEIPTS_3YR_AVG`, `sizeStandardEffectiveDate = "2023-03-17"`, `pendingRuleFlag = true` (SBA
  proposed rule RIN 3245-AI12, Aug 22 2025, **not yet final** — these three codes are reportedly proposed to
  be **retained at $34M**; re-check the in-force table at bid date). `allowed_set_aside_type =
  [TOTAL_SMALL_BUSINESS, UNRESTRICTED]`; **`forbidden_set_aside_type = [EIGHT_A, HUBZONE, SDVOSB, WOSB,
  EDWOSB]`**; `firmCertifications = []`. **Code-level invariant:** the reps/drafting module must **never**
  emit a socio-economic cert claim or check a cert box the firm lacks; a solicitation restricted to a cert the
  firm lacks → **NO-BID (ineligible)**, not "self-certifiable." (`small_business_status` enum supports this.)
- **For the firm:** the firm's actual receipts are private — **operator/accounting must supply & monitor** the
  true 5-yr-average figure (a small IT consultancy is typically well under $34M). A false SAM/offer size or
  cert representation is **FCA / 13 CFR 121 size-misrepresentation** exposure → **BLOCK**, per CLAUDE.md §6.7.
- **Counsel confirm:** the in-force size value at bid date; receipts/affiliation calculation (13 CFR 121.104);
  that SAM annual reps (FAR 52.204-8 / 52.219-1) are current before each bid.

---

## 2. Pricing-brief inputs (the bottoms-up cost model + benchmarking)

> The pricing module outputs a **decision brief = scenarios, never a single "winning number."**

**Indirect-rate structure (DCAA-style, FAR 31.203):** Direct Labor → **Fringe** (on all labor) → **Overhead**
(on labor + fringe) → **G&A** (on **Total Cost Input** = all direct + fringe + OH + materials + subs) → **Fee
last**, on fully-burdened cost. FAR 31.203(c)–(d): pools allocated over a base "common to all cost objectives,"
base not fragmented, pro-rata.

**Wrap / rate formula (per labor category):**
```
laborPlusFringe = baseRate * (1 + fringePct)
afterOverhead   = laborPlusFringe * (1 + overheadPct)
fullyBurdened   = afterOverhead   * (1 + gaPct)         // G&A on TCI
wrapMultiplier  = (1+fringePct) * (1+overheadPct) * (1+gaPct)
billableRate    = fullyBurdened * (1 + feePct)          // fee LAST, on cost
// T&M: feePct lives ONLY in LABOR; lock material/sub/ODC/travel markup = 0 (§1.2)
// FFP: feePct may vary by scenario; NO statutory cap
```

**⚠️ ILLUSTRATIVE industry ranges — NOT this firm's rates. Accounting MUST supply actual
provisional/DCAA-audited/forward-pricing rates before any *actual* bid is submitted.** Per operator
direction, the pricing module **runs end-to-end on these provisional rates for testing / dry-run** so the
full workflow can be validated live, and **watermarks** every output `PROVISIONAL — illustrative rates, NOT
for submission`. The flag is **`provisionalRatesMode` (a non-blocking WARN + watermark), NOT a hard block**.
Reaching the government is still prevented by the separate, **untouched** submission gates (no-auto-submit +
counsel review + human signature + active-SAM + CAGE), so a provisional price can never go out as a real bid:

| Pool | Illustrative range (replace!) | Base |
|---|---|---|
| Fringe | 25–35% | all labor (direct + indirect) |
| Overhead | 20–40% | labor + fringe (lower if fringe is a separate tier) |
| G&A | 8–15% | Total Cost Input |
| Fee/profit | 5–10% | fully-burdened cost (no FFP cap) |
| **Wrap multiplier** | **~1.6–2.2×** base labor (sanity-flag if outside) | |

Worked example: `$1.00 × 1.30 × 1.40 × 1.10 = $2.00` wrap, `× 1.07` fee ≈ **$2.14** billable.

**Benchmarking — USASpending.gov** `POST /api/v2/search/spending_by_award/`. Comparable-set filters:
`naics_codes` (541511/512/519), `psc_codes` (the solicitation's IT D-series PSC), `agencies`
(awarding/toptier), `time_period` + `date_type`, `set_aside_type_codes` (match the solicitation — **never an
8(a)/HUBZone/SDVOSB/WOSB code the firm can't pursue**), `extent_competed_type_codes`, and
**`contract_pricing_type_codes`** — *corrected codes:* **`J` = Firm Fixed Price, `Y` = Time-and-Materials,
`Z` = Labor Hours** (the cost-plus variants are R/U/V; **`R` is Cost-Plus-Award-Fee, NOT T&M**). Report the
distribution (min / p25 / median / p75 / max) — never a single number. Caveat: USASpending values are total
obligations, not clean unit/labor rates — derive comparables carefully (CLINs, PoP, ceiling vs funded).

**Margin-vs-win-probability:** gate behind `hasFirmWinLossData`; if absent, render as a **labeled heuristic
curve only**.

---

## 3. Bid-drafting / compliance checklist (`compliance_checklist`) — pass/fail, each a disqualifier eliminated

> Output is a **draft checklist result + reviewer notes** for Tim **and external counsel** — the module must
> **never** assert the bid "is compliant," "won't be flagged," or "will win." All items `pendingCounsel:true`.

1. **Section L format conformance** — page/volume/font/margin limits, file naming, volume separation,
   submission method/portal, due date/time, required SF forms (SF1449/SF33). *Overrun → WARN (excess pages may
   be discarded unread).*
2. **Section M factor coverage** — every factor **and subfactor** explicitly addressed; cross-map M-factor →
   proposal section. *Unaddressed factor → WARN.*
3. **Reps & certs (FAR 52.204-8)** — SAM **ACTIVE** + reps/certs updated within 12 months; **plus** every
   *solicitation-specific* / commercial-item (52.212-3) rep the CO inserted (don't let "SAM is current" pass
   the whole item).
4. **Amendments acknowledged** — every SF30 acknowledged. *Unacknowledged → **BLOCK** (hard disqualifier).*
5. **Pricing-math reconciliation** — deterministic recompute: `unit × qty = extended`; `Σ extended = CLIN
   total`; `base + options = grand total`; `labor hrs × burdened rate = cost`; cost-volume total == any total
   cited elsewhere. *Mismatch → **BLOCK**.*
6. **Unbalanced pricing (FAR 15.404-1(g); RFO → 15.404-6)** — per-line analysis vs benchmark; WARN when a line
   is materially over/understated (default heuristic trigger e.g. >25% off benchmark, or front-loaded
   base-vs-options). *Label the % a heuristic — the CO makes the legal call; an offer **may be rejected** for
   unacceptable risk.*
7. **No prohibited exceptions** — proposal takes no exception to material terms.

*(In FAR Part 15 negotiated buys the failure mode is "technically unacceptable / outside the competitive
range," not "nonresponsive" — same practical effect; don't legally label a Part 15 proposal "nonresponsive.")*

---

## 4. Operational confirmations & config encoding

| # | Rule | Disposition | Config flag |
|---|---|---|---|
| 1.1 | Limitations on Subcontracting (50% / SAT $350k) | **BLOCK** >50%, WARN >45% | `los.capPct=0.50`, `sat=350_000` |
| 1.2 | T&M 0% markup (MATERIAL/SUB/**ODC/TRAVEL**) | **BLOCK** | `tm.zeroMarkupCostTypes` (+ODC,TRAVEL) |
| 1.2 | FFP margin | **no cap** | (none) |
| 1.3 | TINA ($2.5M civ / $10M def post-6/30/26) | **WARN/flag** | `tina.*`, `adequatePriceCompetition` |
| 1.4 | Excessive pass-through (70% disclosure) | **WARN** | `passThroughDisclosureThresholdPct=70` |
| 1.5 | Price realism / buy-in (5%) | **WARN** (heuristic) | `realismWarningMarginPct=0.05` |
| 1.6 | Size standard $34M / no cert self-rep | **BLOCK** | `SIZE_STANDARD_RECEIPTS_USD=34_000_000` |
| 2 | Indirect rates / wrap | **WARN + watermark** (runs on provisional for testing; never blocks the pipeline) | `provisionalRatesMode=true` |
| 3 | Compliance checklist | per-item BLOCK/WARN | `compliance_checklist[]` |

- **For every threshold:** confirm **BLOCK vs WARN**, then authorize flipping its `pendingCounsel: true` flag
  to **confirmed**.
- **Firm identity for bid pre-fill (operator must supply — NOT researched/invented here):** EIN
  **84-3113166** (on file), **UEI**, **CAGE code** (`orgs.cage_code` currently null — needed), SAM
  registration status, authorized POC + signatory, addresses. Each pre-filled field is a legal statement → the
  human signs (no auto-sign / auto-submit — already enforced by the `proposals` submit + counsel CHECKs).
- **Deterministic authority:** the compliance engine — **not the model** — decides all of the above (Prime
  Directive §2). The AI only drafts/scores; the encoded rules gate.
- **Dry-run vs live submission (operator-directed testing posture):** the **entire pipeline runs end-to-end**
  on provisional rates + provisional (`pendingCounsel`) thresholds so the workflow can be validated **live**,
  with every priced/draft output **watermarked PROVISIONAL**. An **actual bid to the government** is hard-gated
  by a `readyForLiveSubmission` precondition that ALL of these be satisfied — and is the *only* thing that
  blocks: **(1)** counsel-confirmed thresholds (`pendingCounsel` cleared), **(2)** actual indirect rates loaded
  (`provisionalRatesMode` off), **(3)** **active SAM** registration (FAR 52.204-7), **(4)** **CAGE** assigned,
  **(5)** human signature, **(6)** external-counsel review (the existing `proposals` no-auto-submit + counsel
  CHECKs). Until all six clear, the system can generate, score, rank, and draft — but **cannot submit**.

---

## 5. Firm Identity & registration gates (operator-provided 2026-06-16)

Maps to the `orgs` row (`name` / `uei` / `cage_code` / `ein` / `primary_domain`) + `OrgDirectives` (the rest).

| Field | Value |
|---|---|
| Legal name | Burger Consulting LLC |
| **UEI** | **MHWNLSLL4AJ5** |
| **CAGE** | ⏳ **pending** (issued on SAM activation) → `cage_code` stays null |
| EIN | 84‑3113166 (on file) |
| Entity | Single‑member LLC · for‑profit · not tax‑exempt · NY |
| Domain | burgergov.com |
| Congressional district | NY‑13 |
| FY end | Dec 31 (entity since 2019‑09‑20) |
| Signatory / POC | Timothy J Burger — CEO / Managing Member · procurement@burgergov.com · 917‑718‑7978 |
| Business address | 105 E 117th St, Apt 5F, New York, NY 10035‑4610 |
| Socio‑economic certs | **None** (confirmed) |

**Registration gates — block ACTUAL submission only (part of `readyForLiveSubmission`):**
- `samRegistrationActive = false` — SAM submitted 2026‑06‑07, **not yet ACTIVE** (Activation Date blank). **FAR 52.204‑7** requires an active SAM registration at time of offer → **blocks live bidding until active**.
- `cageAssigned = false` — CAGE is issued when SAM activates.

**Excluded from repo/config (held only in SAM / secure payment config):** banking/EFT (Sutton Bank acct/routing), signature, full tax detail. When operationalized, identity/PII belongs in the `orgs` row + runtime config — not a committed doc.

---

## 6. Researched build constants (gap-research addendum — 2026-06-16, each adversarially verified)

### 6.1 Size calc — **5-year averaging** (supersedes §1.6's "3-year")
- `receiptsAveragingYears = 5` (13 CFR 121.104(c); Runway Extension Act 2018, eff. 2020‑01‑06).
- Formula: **≥5 completed FY** → `sum(last 5 FY receipts) / 5`; **<5 FY** → `(total receipts / weeks in business) × 52`.
- `receipts = totalIncome (grossIncome if sole prop) + COGS` per IRS return. Exclusions: net capital gains/losses; taxes collected & remitted; inter‑affiliate proceeds; pass‑through agent collections.
- **Affiliates included** (13 CFR 121.103(a)(6)) — concern + all domestic/foreign affiliates, inter‑affiliate netted. `economicDependenceFlag` when any single customer ≥ **70%** of receipts over the prior 3 FY (121.103(f)).

### 6.2 USASpending benchmark query (`POST /api/v2/search/spending_by_award/`) — codes live-verified
- `contract_pricing_type_codes`: **J=FFP, Y=T&M, Z=Labor Hours** (FFP‑milestone reports as J). Cost‑plus = R/U/V.
- `set_aside_type_codes`: **SBA**=Total Small Business (FAR 19.502‑2), **SBP**=partial, **NONE**=unrestricted. Exclude cert codes (8A/HZC/SDVOSBC/WOSB) the firm lacks.
- `extent_competed_type_codes`: **A**=Full & Open. *(A TSB set‑aside still reports extent A → filter set‑aside via `set_aside_type_codes`, not extent.)*
- `award_type_codes`: **A,B,C,D** for contracts (exclude `IDV_*` — ceilings, not unit prices). **REQUIRED, and contract vs IDV groups can't be mixed → run TWO queries** (set‑aside `[SBA]` + unrestricted `[NONE]`).
- **PSC** (April 2024 restructure): primary **DA01** (App Dev — #1 FPDS match for 541511/541512); secondary **DD01 / DF01 / DA10** (+ **DJ01** security for 541512); legacy **D302/D306/D307/D308/D304/D301/D310/D314/D399** (query both during the transition); exclude **7A20/7A21** (license/product codes). Anchor to the CO‑assigned PSC.
- Output = a distribution (min/p25/**median**/p75/max), never a single number.

### 6.3 Pricing without DCAA-audited rates
- A new/small firm needs **no** audited rates to bid. **Bid rates** (own forward budget, FAR 31.2‑allowable) ≠ **provisional billing rates** (def. FAR **42.701** / establishment basis FAR 42.704) — the latter only matter for **cost‑reimbursable or indirect‑billed T&M**, trued‑up via an **incurred‑cost submission due 6 months after FY end** (FAR 52.216‑7(d)(2)(i)); quick‑closeout at the lesser of **$1M or 10%** (FAR 42.708(a)(2); DoD $2M, DFARS 242.708). **A pure‑FFP firm has NO ICS obligation.**
- `provisionalRatesMode` illustrative defaults (replace before live submission): **fringe 0.31, overhead 0.42, G&A 0.12, fee 0.085**; wrap sanity band 1.6–2.2×. *(Practitioner ranges — not the firm's rates.)*

### 6.4 Heuristic detectors (labeled; `RECOMMEND_HUMAN_REVIEW`, never auto-reject)
- **Unbalanced pricing** — FAR 15.404‑1(g) is purely qualitative (no FAR number): `lineItemDeviationFlagPct = 25` (DFARS 215.404‑1(a)(ii)(A) analog, scoped to spare parts → illustrative for services), watch band `15`; front‑loading flag when first‑period share exceeds the level share by 25–30% **or** an out‑year unit price < 75% of base‑year; **`requireBothOverstatedAndUnderstated = true`** (GAO: an understated item alone is NOT unbalanced).
- **Realism** — `lowMarginWarnPct = 5` (keep), `thinMarginNotePct = 8`, `belowBenchmarkWarnPct = 20` (bid > ~20% below IGCE/median); typical services FFP margin 8–15% (benchmark, not a rule).

### 6.5 Reps & certs (checklist enumeration)
- **FAR 52.204‑8** (annual SAM umbrella): e‑reps election at (b), 12‑month currency at (d); (c)(1) ≈25 auto‑provisions (incl. 52.219‑1 size, 52.209‑5), (c)(2) ≈7 CO‑discretionary.
- **FAR 52.212‑3** (per commercial offer): size at (c)(1), socio‑economic at (c)(2)–(c)(11), responsibility at **(h)** (= 52.209‑5), TIN at (l), ownership at (p).
- **FAR 52.209‑5**: not debarred / no fraud‑antitrust conviction (3 yr) / not indicted / no delinquent taxes.
- **For Burger:** **IS** small (c1 + 52.219‑1); **IS NOT** at c2–c11 (no socio‑economic certs). SAM Modernized Reps & Certs eff. 2026‑03‑24.

### 6.6 Uniform Contract Format + forms
- **UCF A–M** (FAR 15.204‑1 Table 15‑1): **L** = Instructions (FAR 15.204‑5(b)); **M** = Evaluation factors (FAR 15.204‑5(c) → CO inserts a phrase per **15.304(e)**, relative importance per 15.304(d)). Parts I(A–H) / II(I) / III(J) / IV(K–M).
- **Forms:** **SF1449** (commercial Part 12, FAR 53.212 — uses **52.212‑1** instructions + **52.212‑2** evaluation, *not* A–M); **SF33** (FAR 53.214(c)); **SF18** RFQ (FAR 53.213); **SF30** amendments (FAR 53.243).
- **RFO renumber:** L → **15.109‑4(b)**, M → **15.109‑4(c)**. The parser must **branch on form type** (Part 12 commercial vs Part 15 UCF) and support **both** legacy + RFO cites. Checklist: L‑to‑M crosswalk · SF30 amendment acknowledgment · reps & certs complete.

### 6.7 Currency re-check (2026-06-16, confirmed)
SAT **$350,000** · micro‑purchase **$15,000** · TINA **$2.5M civilian / $10M defense‑only after 6/30/2026** (not civilian) · size **$34M** (SBA RIN 3245‑AI12 still **proposed**, not final) · FAR Overhaul via **interim class deviations** (no final rule yet) · Rule of Two retained.

---

## Attorney sign-off (to be completed by the firm's licensed government-contracts counsel)

By signing, counsel confirms they have reviewed each item above against the **bid-date** FAR/SBA authorities
(including any applicable RFO class deviation) and **authorizes** the firm to flip the listed
`pendingCounsel: true` flags to confirmed, **subject to per-solicitation review** before any bid is submitted.

- Reviewing attorney (name, bar, firm): ________________________________________
- Items confirmed as written / items modified (attach redline): ____________________
- Items still **held**: ____________________________________________________________
- Signature / date: ________________________________________________________________

---

*Prepared by Claude Code (AI) on 2026-06-15 from public primary sources, each value adversarially re-verified.
Not legal advice. For confirmation by the firm's licensed government-contracts attorney before any bid.*
