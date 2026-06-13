# Counsel Briefing — Burger Consulting LLC Federal Contracting System

> Purpose: give our government-contracts attorney the context to answer a set of build-shaping questions
> accurately.

---

## 1. About the business

- **Entity:** Burger Consulting LLC, a **single-member** domestic limited liability company formed in
  **New York** on **09/20/2019** (NY DOS ID 5624755; filing no. 190920020027). Current NY status: **Active**.
- **Federal tax ID (EIN):** 84-3113166 (IRS CP 575 G; "Timothy J Burger, Sole Member").
- **Federal tax classification:** as a single-member LLC, treated by default as a **disregarded entity**
  unless an election (Form 8832 / 2553) has been made — *please advise whether any election should be made and
  how this affects our representations.*
- **Principal address:** 105 E 117th St, Apt 5F, New York, NY 10035.
- **Owner / authorized signer:** Timothy J Burger (sole member).
- **Line of work:** federal information-technology services contracting. We intend to bid as a **prime
  contractor** and use **subcontractors** to perform or augment the work.
- **NAICS codes:** 541511 (custom programming), 541512 (computer systems design), 541519 (other computer
  related services).
- **Federal registration status:** SAM.gov **UEI: MHWNLSLL4AJ5** (registration substantially in place).
  **CAGE code: pending** — submitted and responded to the reviewer's request; awaiting final approval.
- **Size status:** We believe we qualify as a **small business**. Note: under our NAICS codes
  (541511/541512/541519), the SBA size standard is based on **average annual receipts**, not employee count.
  As a newly-operating firm with little or no receipts to date, we expect to fall well under the threshold —
  *please confirm the correct basis and how receipts are calculated for a company that registered in 2019 but
  is only now beginning operations.*
- **Socio-economic certifications:** **none currently** (not 8(a), SDVOSB/VOSB, WOSB/EDWOSB, or HUBZone
  certified). Our SAM record lists no active socio-economic types. *Please advise whether we are eligible for,
  and whether we should pursue, any of these.*
- **Contract types we intend to pursue:** primarily **Firm-Fixed-Price** IT services, frequently under
  **IDIQ** vehicles, possibly some **Time-and-Materials**. We do **not** currently intend to bid
  cost-reimbursement (cost-plus) work.
- **Payment arrangements of interest:** where a solicitation offers it, **milestone / performance-based
  payments and progress payments** (FAR Part 32) — i.e., partial payment as defined milestones are completed
  and accepted, with the remainder at final completion.

---

## 2. What we are building, and the human-in-the-loop design

We are building an internal software system that assists with the federal bidding workflow. **This is
decision-support software operated by a human, not an autonomous agent.** The most important point for your
risk assessment:

- The software **sources** solicitations from SAM.gov, **screens** them against our criteria, and
  **discovers and scores** candidate subcontractors — all read-and-analyze only.
- The software **drafts** subcontractor outreach, but **a human reviews and approves every message before it
  is sent**. The software never contacts anyone on its own.
- Subcontractors submit proposals through a portal; the software **analyzes and ranks** them, but **a human
  chooses** the subcontractor and **sets the final price and fee**.
- The software **drafts** a bid and runs a compliance checklist, but **a human reviews the bid, you (counsel)
  review it, and a human submits it.** The software never submits anything to the government.

In short: the software drafts and analyzes; the human decides and acts; counsel reviews every bid before
submission. No certification, contact, price commitment, or submission happens without a person.

---

## 3. Why we need your input now

We are about to build the two highest-stakes components — the **pricing module** (which models fee/margin
scenarios) and the **bid-drafting module** (which assembles a compliant proposal). We want compliance built
in by design rather than patched later, so we need your answers translated into the system's rules and limits
*before* those components are written. The questions in Section 5 are written so your answers map directly to
build settings.

---

## 4. What we are NOT asking

- We are **not** asking you to review the software's code or architecture at this stage.
- We are **not** asking you to pre-approve any specific bid here — every actual bid will be sent to you for
  review before submission, separately.
- We are **not** asking for a guarantee of any outcome; we are asking for the compliance guardrails the system
  must enforce.

---

## 5. Questions (grouped; each notes why it matters to the build)

**Pricing module**

1. For the contract types we bid (FFP, possibly T&M), is there any limit on the fee, profit, or markup we may
   include — and if so, what is it and when does it apply?
   *Why it matters: sets the fee-cap logic; the system flags or blocks any scenario that breaches a limit.*

2. Are there price-reasonableness or price-realism rules we must satisfy so that a competitive low price is not
   disqualified?
   *Why it matters: defines the threshold at which the system flags a price as a realism risk for human review.*

3. Is there a dollar threshold above which we must submit or certify cost-or-pricing data, and what is the
   current figure?
   *Why it matters: the system will flag any solicitation above it for manual handling rather than automate it.*

4. When we mark up a subcontractor's quote to form our price, are there rules or disclosures we must follow?
   *Why it matters: governs how the pricing brief documents and presents the build-up of our price.*

**Bid-drafting module**

5. What is our size status under our NAICS codes, and are we eligible for any set-aside categories (SDVOSB,
   8(a), WOSB, HUBZONE, or none)?
   *Why it matters: determines which set-aside solicitations we may pursue and what we may represent.*

6. Which representations and certifications must appear in our bids, and which are we qualified to make today?
   *Why it matters: defines exactly which reps & certs the bid module includes.*

7. Of those certifications, which — if the system pre-fills them — constitute a legal statement to the
   government that a human must personally review and sign?
   *Why it matters: those fields are configured to require a human signature and cannot be auto-finalized.*

8. Are there eligibility gates that determine whether we may bid a given solicitation at all (active SAM
   registration, CAGE, set-aside restrictions)?
   *Why it matters: the screening step will check these before a solicitation is recommended for bidding.*

**Payments**

9. Which payment/financing arrangements are we eligible for, and how should "pay-when-paid" terms with
   subcontractors be structured so we are not financially exposed?
   *Why it matters: configures the payment-schedule options and the subcontractor agreement terms.*

---

## 6. Supporting documents (available / attached)

- NY Articles of Organization, filed 09/20/2019 (Burger Consulting LLC, NY DOS ID 5624755).
- NY Department of State entity record showing current **Active** status.
- IRS EIN assignment letter (CP 575 G), EIN 84-3113166, identifying the single member.
- SAM.gov record showing **UEI MHWNLSLL4AJ5** (CAGE pending).

We can also provide, on request, our receipts/financials to confirm small-business size status, and examples
of the specific solicitations or contract vehicles we intend to target.
