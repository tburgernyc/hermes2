# Handoff: BurgerGov Operations Console — Backend Wiring

## Overview
This package contains the **finished, interactive front-end** for the BurgerGov operations platform — the human-in-the-loop **Admin console** and the **Subcontractor (Vendor) portal**. Every screen, route, button, form, and HITL gate is built and works against **synthetic in-memory data**.

**The task is NOT to design or rebuild UI.** The UI is done. The task is to **replace the synthetic data layer and the no-op action handlers with calls to the real backend** that already exists in this GitHub repo, preserving the exact UX and the human-in-the-loop guarantees.

## About the design files
The files in `console/` are the **actual working UI**, authored as React (via in-browser Babel) reading globals from a design-system bundle. They are design references for *behavior and appearance* — when you integrate, **recreate these screens in the repo's real app environment** (its framework, router, component library, auth, and data-fetching patterns). Do not ship the Babel/CDN setup to production; port the components into the repo's build. Match the look 1:1 — it's hi-fi.

Two integration styles are fine, pick what fits the repo:
- **Port-in:** move these components into the app and swap `window.CONSOLE` + `onAct`/`go` for the repo's data hooks and router.
- **Reference + rebuild:** treat these as the spec and rebuild in the repo's existing component system.

## Fidelity
**High-fidelity and functionally complete.** Final colors, type, spacing, interactions, loading-free happy paths, and all HITL gating are implemented. Recreate pixel-for-pixel using the repo's design system / tokens. Colors and type come from the BurgerGov design system (dark "Command" theme default + light "Studio" theme via toggle); the repo presumably already has these tokens — reuse them rather than hard-coding.

---

## How the prototype is structured

- `index.html` — app shell: **hash router**, theme state (persisted to `localStorage["bg-theme"]`), ambient background. Defines `VALID` routes, an `App()` with `go(route)` (navigation) and `act(msg)` (fires a success toast). Renders one view per route.
- `console-auth.jsx` — `AppNav` (top nav, role label, sign-out), `PageHeader`, and auth screens: `AuthScreen` (split login, admin & vendor), `TotpScreen`, `EnrollScreen` (2FA setup w/ QR), `InviteOnboard` (invite-token account setup).
- `console-views-admin.jsx` — `AdminHome` (morning brief + quote-injection alert + triage `recommendation` badges), `SolicitationsBoard` (kanban), `SolicitationDetail` (triage `recommendation` + `summary`, injection callout, AI-ranked quotes with per-quote `score` + `risks`), `ProposalBrief` (priced bid decision-brief + AI `narrative` + blockers + review workflow), `ApprovalsView` (match score / capability % / `recommendation`), `ApprovalDetail` (split-view vendor cohort with match reasoning + **long-press release gate**), `InquiriesView`, `ProspectsView`, `VendorsView`. The advisory AI fields are display-only (see HITL invariant 5).
- `console-views-vendor.jsx` — `VendorHome`, `RfqsView`, `QuoteSubmitView` (line items + upload), `MyQuotesView`, `QuoteView`, `ContractsView`, `DocumentsView`.
- `data.js` — **`window.CONSOLE`**: the synthetic dataset. **This is the contract.** Every shape here is what a screen expects back from the backend. Comment in-file: *"Synthetic but shaped like the real hermes2 schema."*
- `console.css` — layout/styling (theme-aware, reads DS tokens).

### The two seams to replace
1. **Reads** — components read from `window.CONSOLE.<key>`. Replace each with a fetch/query to the matching endpoint.
2. **Writes / actions** — buttons call `onAct("...message")` (which just shows a toast) or `go("route")`. Replace `onAct` calls with the real API mutation, then surface the real result (success/error toast, optimistic update, or refetch).

---

## Action → endpoint mapping

> Endpoint paths below are **suggested names** to confirm against the repo's actual API. Fill the right column with the real route + method during integration. Keep the HITL invariant: **a write only happens on an explicit human click; rendering a screen never mutates state.**

### Auth & session
| UI trigger (file) | Intended call | Real endpoint (fill in) |
|---|---|---|
| Admin login submit → `go("admin-totp")` (`AuthScreen`, admin) | `POST /auth/admin/login` {email,password} → returns "totp required" challenge | |
| TOTP 6-cell complete / Verify (`TotpScreen`) | `POST /auth/admin/totp` {code} → session token | |
| 2FA enrollment confirm (`EnrollScreen`) | `POST /auth/admin/totp/enroll` {code} (after `GET /auth/admin/totp/setup` for QR + secret) | |
| Vendor login submit → `go("vendor")` (`AuthScreen`, vendor) | `POST /auth/vendor/login` {email,password} → session | |
| Invite onboarding submit (`InviteOnboard`) | `POST /auth/invite/:token` {password} → activates vendor user, returns session | |
| Sign out (`AppNav`) | `POST /auth/logout` | |

### Admin — reads
| Screen | Data key in `data.js` | Intended call |
|---|---|---|
| Morning brief (`AdminHome`) | `brief.stats`, `brief.injection` (quote-injection alert), `triaged` (+ `recommendation`), `inquiries` (NEW), `deadlines` | `GET /admin/brief` |
| Solicitations board (`SolicitationsBoard`) | `board` (5 columns; Triage items carry `recommendation`) | `GET /admin/solicitations?view=board` |
| Solicitation detail (`SolicitationDetail`) | `solicitationDetail` — triage `recommendation` + `summary`, `injectionAttempts[]`, `scope`, and `quotes` AI-ranked with per-quote `score` + `risks[]` | `GET /admin/solicitations/:id` |
| Proposal brief (`ProposalBrief`) | `proposal` (scenarios, compliance, bidChecklist, blockers, `narrative` — exec summary / technical / management / past-performance / assumptions) | `GET /admin/solicitations/:id/proposal` |
| Approvals (`ApprovalsView`) | `triaged` (+ `recommendation`), `outreach` (+ `matchScore`, `capabilityMatch`, `recommendation`) | `GET /admin/approvals` |
| Approval detail (`ApprovalDetail`) | `approvalDetail` (`sourceLines`, `recipients[]` — per-vendor `recommendation` / `matchScore` / `capabilityMatch` / `strengths` / `gaps` / `lowConfidence`) | `GET /admin/approvals/:id` |
| Inquiries (`InquiriesView`) | `inquiries` | `GET /admin/inquiries` |
| Prospects (`ProspectsView`) | `prospects` | `GET /admin/prospects` |
| Vendors (`VendorsView`) | `vendors` (qualifiedProspects, pendingVendors, inviteLink) | `GET /admin/vendors` |

### Admin — HITL writes (the gates)
| Button (file) | Intended call |
|---|---|
| Approve sourcing (`SolicitationsBoard`, `ApprovalsView`) | `POST /admin/solicitations/:id/approve-sourcing` |
| No-go (`SolicitationsBoard`) | `POST /admin/solicitations/:id/no-go` |
| Approve & send outreach / Reject (`ApprovalsView`) | `POST /admin/outreach/:id/approve` · `POST /admin/outreach/:id/reject` |
| Shortlist vendor (`SolicitationDetail`) | `POST /admin/solicitations/:id/quotes/:quoteId/shortlist` |
| Select winner (`SolicitationDetail`) | `POST /admin/solicitations/:id/select-winner` {quoteId} → generates priced bid draft |
| Record counsel review (`ProposalBrief`) | `POST /admin/proposals/:id/counsel-review` |
| Mark ready / Submit to agency (`ProposalBrief`) | **Stay disabled until backend reports all live-submission blockers cleared.** `GET …/proposal` must return `blockers[]`; enable only when empty. Then `POST …/mark-ready`, `POST …/submit`. |
| Release gate — long-press dispatch (`ApprovalDetail` → `ReleaseGate`) | `POST /admin/approvals/:id/dispatch` — only after the 1.5s hold completes |
| Mark inquiry reviewed (`InquiriesView`) | `POST /admin/inquiries/:id/reviewed` |
| Add prospect / Mark qualified (`ProspectsView`) | `POST /admin/prospects` · `POST /admin/prospects/:id/qualify` |
| Promote to vendor / Mark vetted / Link user (`VendorsView`) | `POST /admin/vendors/promote` · `/admin/vendors/:id/vet` · `/admin/vendors/link` |
| Generate & copy invite link (`VendorsView`) | `POST /admin/vendors/:id/invite` → returns single-use link (app shows it; admin sends it manually — **app never emails on its own**) |

### Vendor (subcontractor)
| Screen / button | Data key / call |
|---|---|
| Dashboard (`VendorHome`) | `vendorStats`, `rfqs`, `myQuotes`, `documents` → `GET /vendor/dashboard` |
| Open RFQs (`RfqsView`) | `rfqs` → `GET /vendor/rfqs` |
| Submit quote (`QuoteSubmitView`) | `GET /vendor/rfqs/:id` (`quoteTarget`); **Submit** → `POST /vendor/quotes` {lineItems, pop, payWhenPaid, notes, documentId} |
| Quote document upload (`QuoteSubmitView` upload zone) | `POST /vendor/uploads/sign` → signed URL → PUT to storage → attach id. Magic-byte/type validated server-side. |
| My quotes / Quote detail (`MyQuotesView`, `QuoteView`) | `myQuotes`, `quote` → `GET /vendor/quotes`, `GET /vendor/quotes/:id` |
| Subcontracts (`ContractsView`) | `contracts` → `GET /vendor/contracts` |
| Documents + upload (`DocumentsView`) | `documents` → `GET /vendor/documents`; drop → signed-URL upload + background scan |

---

## Human-in-the-loop invariants (must preserve)
These are load-bearing product guarantees — keep them through the wiring:
1. **Rendering never advances state.** Only explicit button clicks call mutations. No autosubmit on view.
2. **Live submission is gated.** "Mark ready" and "Submit to agency" stay disabled while `blockers[]` is non-empty (CAGE pending, counsel signature, specialist cert, etc.).
3. **The release gate requires deliberate intent** — the 1.5s long-press; releasing early cancels and dispatches nothing.
4. **The app never emails on its own.** Invite links are generated and shown for the admin to send.
5. **AI outputs are recommendations.** Triage scores, the `recommendation` badge (PURSUE / HUMAN_REVIEW / REJECT), the triage `summary`, per-prospect match reasoning (`matchScore` / `capabilityMatch` / `strengths` / `gaps`), per-quote `score` + `risks`, the quote-injection alerts, and the proposal `narrative` are **advisory and display-only** — they are surfaced to inform the operator and **gate nothing**. The human decides; low-confidence rows are flagged and require human confirmation. Nothing here picks a number, advances a state, or submits anything.
6. **Vendor-to-vendor isolation, and operator-only AI fields.** A subcontractor only ever sees their own quotes/docs; quotes are never exposed across vendors. The operator-only AI fields above (triage `summary`/`recommendation`, quote-`injection` flags, proposal `narrative`, per-quote `score`/`risks`) are **never readable by the vendor or token roles** — the repo enforces this with column-level grants (`migrations/manual/0012_ai_field_grants.sql`: table-wide `SELECT` revoked, then re-granted only on the non-operator columns).

## State & data-fetching guidance
- Current state is component-local + the global `window.CONSOLE`. Replace with the repo's data layer (React Query / SWR / RTK Query / server components — whatever the repo uses).
- Theme is persisted to `localStorage["bg-theme"]` (`"command"` = dark default, `"studio"` = light). Keep or map to the repo's theming.
- Routing is hash-based here (`#admin`, `#vendor-login`, `#approval-detail`, …) so the marketing site can deep-link in. Preserve those entry points (the marketing site links to `…/console#vendor-login` and `#admin-login`), or set up equivalent real routes + redirects.

## Design tokens
Colors/type/spacing come from the BurgerGov design system (the repo should already have these). Dark "Command": ground `#09090b`, ink `#fafafa`, muted `#a1a1aa`, primary (hyper-blue) `#3b82f6`, signal (emerald) `#34d399`. Fonts: **Schibsted Grotesk** (display/body), **JetBrains Mono** (mono/labels). Reuse the repo's token definitions rather than re-declaring.

## Files in this bundle
- `SCREENS.png` — labeled contact sheet of all 18 console screens (visual index)
- `console/index.html` — shell + hash router + theme + route table
- `console/console-auth.jsx` — nav, page header, all auth screens
- `console/console-views-admin.jsx` — all admin screens + `ReleaseGate`
- `console/console-views-vendor.jsx` — all vendor screens
- `console/console.css` — styles (theme-aware)
- `console/data.js` — **the data contract** (`window.CONSOLE`) every screen expects
- `console/ORIGINAL_README.md` — the kit's own screen notes

## Open questions to resolve against the repo
1. Real auth model: session cookies vs bearer tokens; how TOTP verify/enroll endpoints are shaped; invite-token format.
2. Real route names + payload schemas (confirm each row above).
3. File upload mechanism (signed URL provider, size/type limits, scan worker hooks).
4. Where these screens mount in the repo's app (route prefixes, layout, existing component library to reuse).
5. Which "blockers" are computed server-side so the submit gate reflects real state.
