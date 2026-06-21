# Discovery Report — BurgerGov Console/Marketing → hermes2 Backend Wiring

> **Phase 1, discovery only. No code modified.** Read-only exploration reconciling
> `design_handoff_console_backend_wiring/` and `design/ui_kits/{console,marketing}/`
> against the real hermes2 app. Generated 2026-06-21.

## TL;DR

The backend the handoff asks us to wire is **already built** — and the admin/portal/marketing
route groups **already exist** in `apps/web/app/`. The handoff's "suggested endpoint names" are
REST-style placeholders; the repo's real surface is **Next.js Server Actions + RSC reads** behind
Auth.js v5. So the job is **(a) port the hi-fi UI 1:1 into the existing routes**, **(b) swap the
synthetic `window.CONSOLE`/`window.SITE` reads for the existing RSC queries**, and **(c) reconcile
~5 genuine architectural mismatches** (auth shape, upload mechanism, two missing read surfaces, one
missing aggregate). Almost no new backend is required.

---

## Part 1 — Platform facts

| Concern | Reality in repo |
|---|---|
| **Framework / router** | Next.js 15 App Router (RSC + Server Actions). File-based routing under `apps/web/app/`. Route groups: `(marketing)`, `admin/(console)`, plus `portal/`, public token pages `quote/[token]`, `optout/[token]`, `invite/[token]`, and `/login`, `/dashboard`. |
| **Auth model** | **Auth.js v5 (next-auth 5 beta), JWT session strategy**, cookie `__Secure-auth-session` (httpOnly, secure). **One unified Credentials login** for both roles (`apps/web/app/login/actions.ts:13` → `signIn("credentials")` → `/dashboard` role router). `authorize` in `apps/web/auth.ts:33` verifies password (argon2id), checks DB lockout + HTTP rate-limit, and **server-resolves `vendorId`** from `users.vendor_id` (never client-set). |
| **Session claims** | `auth.config.ts:9-17` / `auth.ts` jwt+session callbacks: `id, orgId, role (admin\|vendor), vendorId, totpEnrolled, totpVerified`. The **only** path to `totpVerified=true` is the Node-runtime jwt callback verifying a live code against the stored AES-GCM secret (`auth.ts:78`) — Prime Directive §2 safe. |
| **TOTP** | Enroll: `/admin/totp/enroll` page renders QR + persists ciphertext; `confirmEnrollAction` (`enroll/actions.ts:12`) verifies code → marks enrolled → `updateTotp({refreshEnrollment:true})`. Step-up: `/admin/totp` page; `verifyTotpAction` (`totp/actions.ts:20`) verifies → elevates session, with per-account durable DB lockout. **There is no token-returning TOTP REST endpoint** — it's a session-update via `unstable_update`. |
| **Middleware gates** | `apps/web/middleware.ts`: `/admin/**` → auth + admin + `totpEnrolled` + `totpVerified` (except `/admin/totp/*`); `/portal/**` → auth + vendor; `/dashboard` → auth (role router). Also attaches per-request nonce'd CSP to **every** HTML response. |
| **Existing API route handlers** | Only 5, none of them the handoff's "endpoints": `api/auth/[...nextauth]`, `api/inngest`, `api/health`, `api/csp-report`, `api/portal/ping`. **All admin/vendor writes are Server Actions, not routes.** |
| **DB / ORM** | Neon Postgres + Drizzle, org-scoped RLS. Access via `withOrg` (hermes_app), `withVendorRole` (hermes_vendor, per-vendor RESTRICTIVE RLS), `withTokenRole` (hermes_token, public tokenized writes), `withAuthRole` (hermes_auth, login). |
| **Component library** | **CSS Modules throughout** (no inline styles — CSP style-src is strict). Shared primitives `apps/web/components/ui/`: `Alert, AuthScreen, Brand, Button, Field, console (shell)`. Marketing `_components/`: `Credentials, Cta, PlaceholderBadge, SiteHeader, SiteFooter`. |
| **Design tokens** | Already in repo: `apps/web/app/globals.css` (Studio light + Command dark token sets) and `design/tokens/*.css` (colors, typography w/ Schibsted Grotesk + JetBrains Mono, spacing, effects/glass, theme-command). **Reuse these — do not re-declare.** The handoff's stated palette/fonts match. |
| **Brand single-source** | `apps/web/lib/site.ts` (BRAND_NAME, LEGAL_NAME, CAPABILITIES, CREDENTIALS w/ confirmed\|assigned\|**pending** states, PRINCIPAL, NAICS). `lib/portal.ts` (`OPEN_RFQ_STATUSES`, `humanizeStatus`, `formatUsd`). `lib/admin-board.ts` (`SOLICITATION_BOARD` 5 lanes, `groupByColumn`, `QUALIFIABLE_PROSPECT_STATUSES`). |

### DB schema (the `window.CONSOLE` contract → real columns)
`packages/db/src/schema/*` — org-scoped tables with composite `(org_id,id)` FKs. Key tables &
status enums:
- `orgs`, `users` (role enum ADMIN/VENDOR; `vendorId` link; totp columns; lockout columns)
- `solicitations` — status enum `PENDING_TRIAGE, TRIAGE_COMPLETE, NO_GO, READY_FOR_SOURCING, AWAITING_APPROVAL, SOURCING_IN_PROGRESS, PRICING_PENDING, PROPOSAL_DRAFT, SUBMITTED, AWARDED, CLOSED, REJECTED`; `feasibilityScore (1-10)`, `zeroFloatFit`, `isServices`, `responseDeadline`, `scopeText`, `sourcingApprovedBy/At`.
- `vendorProspects` (status `NEW…QUALIFIED…PROMOTED/OPTED_OUT`, `discoveryScore`), `vendors` (status `PENDING_REVIEW/VETTED/…`, `vettedBy/At`, `promotedFromProspectId` 1:1).
- `outreachCampaigns` (status `DRAFT/PENDING_APPROVAL/APPROVED/SENT/…`, token hashes, `approvedBy/At`).
- `vendorQuotes` (status `INVITED…SUBMITTED/SHORTLISTED/SELECTED`, **XOR** `vendorId`/`prospectId`, `tokenJti` replay, `aiRank`, `aiRationale`) + `vendorQuoteLineItems` (cost types LABOR/MATERIAL/ODC/SUBCONTRACT/TRAVEL; FAR 52.219-14 fields).
- `proposals` (status `DRAFT/COUNSEL_REVIEW/READY_TO_SUBMIT/SUBMITTED/…`, `pricingScenarios` JSONB, `complianceChecklist` JSONB **incl. `liveSubmission.blockers[]`**, `counselReviewedBy/At`, `submittedBy/At`; no-auto-submit CHECK).
- `contracts` (status, `esignStatus`) + `contractMilestones` + `arFollowups`.
- `documents` (entity-type discriminated XOR ownership; `storageKey`, `sha256`, `magicByteValidated`).
- `contactInquiries` (intent TEAMING/AGENCY/OTHER; status NEW/REVIEWED).
- `auditLog` (append-only), `vendorInvites` (single-use `tokenJti`, `acceptedAt/acceptedUserId`).

---

## Part 2 — Action → backend reconciliation

> Legend: ✅ exists 1:1 · ⚠️ exists but **shape differs** (rewire, don't rebuild) · ❌ missing (build)

### Auth & session
| Handoff intended call | Real backend | Verdict |
|---|---|---|
| `POST /auth/admin/login` (separate admin login) | `loginAction` unified credentials (`login/actions.ts:13`) → role-routed at `/dashboard` | ⚠️ One login, not two. Marketing `#admin-login`/`#vendor-login` deep-links → redirect to `/login`. |
| `POST /auth/admin/totp` → session token | `verifyTotpAction` (`admin/totp/actions.ts:20`) — session **update**, no token returned | ⚠️ Session-cookie elevation, not a bearer token. |
| `GET /auth/admin/totp/setup` + `POST …/enroll` | `/admin/totp/enroll` page (QR) + `confirmEnrollAction` (`enroll/actions.ts:12`) | ✅ (setup is page render, not a GET endpoint) |
| `POST /auth/vendor/login` (separate) | same unified `loginAction` | ⚠️ Same unified login. |
| `POST /auth/invite/:token` {password} | `acceptInvite` (`invite/[token]/actions.ts:48`) — creates VENDOR user, role hardcoded, email+vendorId from token | ✅ |
| `POST /auth/logout` | `signOut()` from `@/auth` | ✅ |

### Admin — reads (RSC page loads, not GET endpoints)
| Handoff read | Real source | Verdict |
|---|---|---|
| `GET /admin/brief` | `admin/(console)/page.tsx` (triaged top-5, pendingOutreach count, pricing, 72h deadlines, AR overdue) | ✅ |
| `GET /admin/solicitations?view=board` | `solicitations/page.tsx` + `groupByColumn` (5 lanes) | ✅ |
| `GET /admin/solicitations/:id` | `solicitations/[id]/page.tsx` (sol + AI-ranked quotes + prospect/vendor names) | ✅ |
| `GET /admin/solicitations/:id/proposal` (scenarios, compliance, **blockers[]**) | `solicitations/[id]/proposal/page.tsx` reads `proposals.pricingScenarios` + `.complianceChecklist.liveSubmission.blockers[]` | ✅ blockers ARE server-computed |
| `GET /admin/approvals` | `approvals/page.tsx` (triaged + pendingOutreach) | ✅ |
| `GET /admin/approvals/:id` (`approvalDetail` sourceLines/evalLines, split-view) | **no `approvals/[id]` route exists** | ❌ MISSING read surface |
| `GET /admin/inquiries` | `inquiries/page.tsx` | ✅ |
| `GET /admin/prospects` | `prospects/page.tsx` | ✅ |
| `GET /admin/vendors` | `vendors/page.tsx` (qualifiedProspects, pendingVendors, vettedVendors, unlinkedUsers) | ✅ |

### Admin — HITL writes
| Handoff button | Real server action (file:line) | Verdict |
|---|---|---|
| Approve sourcing | `approveSourcing` (`approvals/actions.ts:27`) — emits `hermes/sourcing.approved` | ✅ |
| No-go | `markNoGo` (`solicitations/actions.ts:32`) | ✅ |
| Approve / Reject outreach | `approveOutreach` (`approvals/actions.ts:73`) · `rejectOutreach` (`:115`) | ✅ |
| **Release gate — long-press dispatch** (`POST /admin/approvals/:id/dispatch`) | **= `approveOutreach`** (the deliberate-intent UI affordance over the outreach-send approval). No separate "dispatch" action exists or is needed. | ⚠️ Wire the 1.5s long-press to `approveOutreach`; keep the gate UX. |
| Shortlist quote | `shortlistQuote` (`solicitations/actions.ts:68`) | ✅ |
| Select winner | `selectQuote` (`solicitations/actions.ts:109`) — atomic single-winner guard, emits `hermes/quote.selected` (drafts priced bid) | ✅ |
| Record counsel review | `counselReviewProposal` (`proposal/actions.ts:41`) | ✅ |
| Mark ready / Submit | `markProposalReady` (`proposal/actions.ts:73`) · `submitProposal` (`:119`, recomputes `readyForLiveSubmission`, blocks on provisional baseline) | ✅ gate intact |
| Mark inquiry reviewed | `markInquiryReviewed` (`inquiries/actions.ts:17`) | ✅ |
| Add prospect / Qualify | `addProspect` (`prospects/actions.ts:42`) · `markProspectQualified` (`:94`) | ✅ |
| Promote / Vet / Link user | `promoteProspectToVendor` (`vendors/actions.ts:43`) · `vetVendor` (`:105`) · `linkVendorUser` (`:146`) | ✅ |
| Generate & copy invite link | `inviteVendorUser` (`vendors/actions.ts:214`) — mints token, stores hash, returns one-time link; copy-link only, no email | ✅ matches "app never emails on its own" |

### Vendor (subcontractor)
| Handoff | Real source (file:line) | Verdict |
|---|---|---|
| Dashboard `GET /vendor/dashboard` (vendorStats, rfqs, myQuotes, documents **aggregated**) | `portal/page.tsx` only shows linkage status; the data lives on separate pages (rfqs/quotes/documents/contracts) | ⚠️/❌ No single aggregate dashboard read — either build an aggregate or restyle VendorHome to link out (decision needed). |
| Open RFQs `GET /vendor/rfqs` | `portal/solicitations/page.tsx` (status ∈ `OPEN_RFQ_STATUSES`) | ✅ |
| Get RFQ detail `GET /vendor/rfqs/:id` | embedded in `portal/solicitations/[id]/quote/page.tsx` (no standalone detail page) | ⚠️ Covered by the quote page. |
| Submit quote `POST /vendor/quotes` | `submitQuote` (`portal/solicitations/[id]/quote/actions.ts:89`) — vendorId from session, line items, status SUBMITTED | ✅ |
| **Upload sign `POST /vendor/uploads/sign` → signed URL → PUT** | **No signed-URL upload endpoint.** Repo uploads the file **through the server action** (magic-byte validated server-side, stored via `getStorage()`). Documents page signs URLs for **downloads** only. | ⚠️ Mechanism differs — wire upload zone to the form/server-action path, not a pre-signed PUT. |
| My quotes / detail | `portal/quotes/page.tsx` · `[id]/page.tsx` | ✅ |
| Contracts | `portal/contracts/page.tsx` | ✅ |
| Documents read + **drop-zone upload** | read: `portal/documents/page.tsx` (signed download URLs) ✅. **Standalone document upload (DocumentsView drop) has no backing** — docs are only created as a side-effect of quote submit. | ⚠️ read ✅ / ❌ independent upload missing |

**Mismatch summary (the only real work beyond porting/rewiring):**
1. **Auth shape** — unified login + session-cookie/TOTP-update, not separate REST endpoints returning tokens. Rewire kit auth screens accordingly; redirect `#admin-login`/`#vendor-login`.
2. **`approvals/[id]` detail** read surface — ❌ build (ApprovalDetail split-view sourceLines/evalLines).
3. **Vendor aggregate dashboard** — ⚠️ decide: build `GET /vendor/dashboard` aggregate vs. link-out VendorHome.
4. **Upload mechanism** — server-action upload, not signed-URL PUT; no standalone document upload endpoint.
5. **Release-gate long-press** wires to existing `approveOutreach` (no new "dispatch" action).

---

## Part 3 — Where the screens mount

### Console kit (`design/ui_kits/console/` + `design_handoff_console_backend_wiring/console/`)
All target route groups **already exist** — port the hi-fi look 1:1 into them, swap `window.CONSOLE`
+ `onAct`/`go` for the RSC reads + server actions above.

| Kit screen (hash route) | Mount at (existing repo route) |
|---|---|
| `AuthScreen` (`#admin-login`/`#vendor-login`) | `apps/web/app/login/` (unified) — add redirects from the hash deep-links |
| `TotpScreen` (`#admin-totp`) | `apps/web/app/admin/totp/page.tsx` |
| `EnrollScreen` | `apps/web/app/admin/totp/enroll/page.tsx` |
| `InviteOnboard` | `apps/web/app/invite/[token]/page.tsx` |
| `AdminHome` (`#admin`) | `apps/web/app/admin/(console)/page.tsx` |
| `SolicitationsBoard` | `apps/web/app/admin/(console)/solicitations/page.tsx` |
| `SolicitationDetail` | `…/solicitations/[id]/page.tsx` |
| `ProposalBrief` | `…/solicitations/[id]/proposal/page.tsx` |
| `ApprovalsView` | `…/approvals/page.tsx` |
| `ApprovalDetail` + `ReleaseGate` | **new** `…/approvals/[id]/page.tsx` (build the read) |
| `InquiriesView` | `…/inquiries/page.tsx` |
| `ProspectsView` | `…/prospects/page.tsx` |
| `VendorsView` | `…/vendors/page.tsx` |
| `VendorHome` | `apps/web/app/portal/page.tsx` (decide aggregate vs link-out) |
| `RfqsView` | `apps/web/app/portal/solicitations/page.tsx` |
| `QuoteSubmitView` | `…/portal/solicitations/[id]/quote/page.tsx` |
| `MyQuotesView` / `QuoteView` | `…/portal/quotes/page.tsx` · `[id]/page.tsx` |
| `ContractsView` | `…/portal/contracts/page.tsx` |
| `DocumentsView` | `…/portal/documents/page.tsx` |

### Marketing kit (`design/ui_kits/marketing/`)
Mounts into the existing `apps/web/app/(marketing)/` route group (home, capabilities, about, contact,
privacy, terms) reusing `_components/` + `lib/site.ts`. Keep the truthfulness contract (PlaceholderBadge
for `pending` credentials/CAGE/PDF). Marketing deep-links `…/console#vendor-login`/`#admin-login` must
resolve to real `/login` (with role redirect) or be rewritten.

### Theme & deep-linking notes
- Kit theme persists to `localStorage["bg-theme"]` (`command` dark default / `studio` light) — map to repo's existing `globals.css` token themes.
- Kit routing is hash-based for marketing→console deep-linking; the real app is path-based — preserve entry points via redirects.

---

## Open questions resolved against the repo (handoff §"Open questions")
1. **Auth model:** session **cookies** (JWT strategy), not bearer tokens. TOTP verify/enroll are session-update server actions, not token endpoints. Invite token = HMAC-SHA256 signed, single-purpose, `jti` replay-guarded (`packages/core/src/tokens.ts`).
2. **Route names + payloads:** Server Actions (FormData), not REST. Mapping table above is the confirmation.
3. **Upload:** server-action upload, magic-byte validated, `getStorage()` (Tigris/S3) — **not** client pre-signed PUT. Download URLs are signed. 25 MB cap, PDF/DOCX.
4. **Mount points:** the `(marketing)`, `admin/(console)`, and `portal/` route groups already exist; port in place.
5. **Blockers:** computed server-side in `proposals.complianceChecklist.liveSubmission.blockers[]`; `submitProposal` re-derives `readyForLiveSubmission` from current org directives every attempt.

## HITL invariants — all already enforced server-side (preserve when wiring)
Rendering never mutates (reads are RSC, writes are explicit server actions) · live-submission gated by
`blockers[]` + `readyForLiveSubmission` · invite is copy-link only (no auto-email) · AI outputs are
advisory (`aiRank`/`aiRationale`, human shortlist/select) · vendor-to-vendor isolation via
`withVendorRole` RESTRICTIVE RLS. The long-press release gate is a **UI** affordance over `approveOutreach`.

---

_Discovery only — no implementation performed. The CCG multi-model runtime (`codeagent-wrapper`,
`~/.claude/.ccg/prompts/*`) is not installed; this report was produced with native read-only
exploration, which also aligns with CLAUDE.md §10 (external multi-model orchestration disabled for
this regulated codebase)._
