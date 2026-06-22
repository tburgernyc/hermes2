# BUILD_INDEX.md — Hermes 2.0

The map of what exists, where each file goes, and what Claude Code generates around it.
Hand this + all files to Claude Code; it consumes them across the phased build.

---

## How to use this

There are TWO piles of files. Treat them differently.

**Pile A — place in the repo NOW (control + Phase 0 plumbing):**
`CLAUDE.md`, `PROJECT_PLAN.md`, `BUILD_INDEX.md`, `LAWYER_BRIEFING.md` → repo root.
`.env.example` → repo root. `ci.yml` → `.github/workflows/ci.yml`.
Claude Code reads these to know how to build.

**Pile B — stage OUTSIDE the repo, integrate ONE PHASE AT A TIME:**
All the `.ts` reference files. Keep them in a folder beside the repo (e.g. `hermes-reference/`).
Do NOT drop them in during Phase 0 — they import packages and dependencies (`@hermes/db`,
`@anthropic-ai/sdk`, etc.) that don't exist until later phases, so CI would fail immediately.
Move each into the repo at its path (table below) when you start that file's phase. The simplest
way: at the start of each phase tell Claude Code "the reference file for this phase is at
`hermes-reference/<name>` — integrate it," and it will place and wire it.

**Sequence:**
1. Create a fresh GitHub repo; place Pile A.
2. Run Phase 0 (scaffold + CI + Fly deploy). Get a green PR and a live URL. Pile B stays staged.
3. For each later phase: paste its prompt, integrate that phase's reference file, one PR = one green check.
   Use plan mode for Phases 1, 3, 4.
4. Keep `ANTHROPIC_API_KEY` out of the Claude Code shell (CLAUDE.md §4). Confirm subscription auth via `claude doctor`.

---

## Control documents (repo root)

| File | Role |
|---|---|
| `CLAUDE.md` | Operating contract Claude Code re-reads every session. Prime directive, stack, verified compliance ruleset, locked decisions. |
| `PROJECT_PLAN.md` | The 7 phases as paste-in prompts, each with acceptance criteria. |
| `LAWYER_BRIEFING.md` | Counsel packet (filled with your verified entity facts). Take to a real attorney. |
| `BUILD_INDEX.md` | This file. |

## Reference implementations (hard-to-get-right; provided)

Some files download with a flattened name (e.g. `quote-actions.ts`, `inngest-route.ts`). Rename/place
them at the **Repo path** column below. Where two files share a name (`client.ts`), the Phase column
tells you which is which.

| File (as downloaded) | Repo path | Phase |
|---|---|---|
| `schema.ts` | `packages/db/src/schema.ts` | 1 — data spine: tables, pgvector, compliance fields, payment schedule, multi-tenant |
| `schemas.ts` | `packages/ai/src/schemas.ts` | 3 — Zod schemas for all AI outputs |
| `client.ts` (ai) | `packages/ai/src/client.ts` | 3 — structured-output + fallback, fail-closed, untrusted fencing, prompt cache |
| `compliance.ts` | `packages/ai/src/compliance.ts` | 3/6 — VERIFIED FAR/SBA rules as deterministic code (pending counsel) |
| `engine.ts` | `packages/ai/src/engine.ts` | 3 — triage, score, evaluate, SOW, proposal draft, export, embed |
| `tokens.ts` | `packages/core/src/tokens.ts` | 2 — signed single-purpose portal tokens |
| `auth-guard.ts` | `packages/core/src/auth-guard.ts` | 2 — trust boundary: RBAC, TOTP gate, tenant isolation, lockout |
| `upload.ts` | `packages/core/src/upload.ts` | 5 — magic-byte file validation + Tigris signed URLs |
| `quote-actions.ts` | `apps/web/app/quote/[token]/actions.ts` | 5 — tokenized, prospect-scoped submission + opt-out |
| `client.ts` (inngest) | `inngest/client.ts` | 4 — typed event registry |
| `safety.ts` | `inngest/safety.ts` | 4 — SSRF-guarded fetch + append-only audit |
| `functions.ts` | `inngest/functions.ts` | 4 — crons + the waitForEvent human-approval gate |
| `inngest-route.ts` | `apps/web/app/api/inngest/route.ts` | 0/4 — serves the functions |
| `.env.example` | repo root | 0 — env contract |
| `ci.yml` | `.github/workflows/ci.yml` | 0 — required checks |

## What Claude Code generates (routine; not provided)

- **Phase 0:** monorepo scaffold (pnpm + Turborepo), tsconfig/eslint/prettier, Dockerfile, fly.toml, SessionStart hook, hello-world deploy.
- **Phase 1:** the migration + seed from `schema.ts`; schema tests on a throwaway Neon branch. (Add `optedOut boolean` to `vendor_prospects` — see quote-actions.ts.)
- **Phase 2:** Auth.js v5 config wired to populate `user.{id,orgId,role,totpVerified}`; TOTP enroll/verify; password hashing; the Playwright auth-boundary suite.
- **Phase 3:** tests incl. the injection test and the beta-fallback test.
- **Phase 4:** tests proving the gate (triage sends zero emails; outreach only after approval; SSRF rejected). Wire SAM.gov response shape to the live API.
- **Phase 5:** the vendor dashboard UI (authenticated CRUD behind `requireVendor()`), the `/quote` + `/optout` pages that call the provided actions, the negative-test suite.
- **Phase 6:** the admin dashboard + pricing decision brief UI + bid assembly, calling `compliance.ts`. **GATED on counsel** (see below).
- **Post-build (branch `burgergov-ui`):** the AI outputs the pipeline was dropping (triage summary/recommendation, per-quote AI score + risks, quote-injection flags, prospect match reasoning, proposal narrative) are persisted and surfaced **read-only** on the console — drizzle migration `0004_tearful_sister_grimm.sql` (+ `ai_recommendation` enum) and the column-level grants `manual/0012_ai_field_grants.sql` (operator-only fields withheld from the vendor/token roles). Advisory + display-only; gates nothing.
- **Phase 7:** marketing site, CSP/headers, rate limits, Sentry + external heartbeat, go-live checklist.

## Open dependencies (yours to close)

1. **Attorney review** of the `CLAUDE.md §6` compliance ruleset before Phase 6 ships. The rules are coded `pendingCounsel`; counsel's answers change thresholds in `compliance.ts` only.
2. **CAGE finalization** (independent of this build).
3. **SAM** physical-address consistency with your formation/EIN docs.
4. **Verify** current per-token Anthropic pricing before trusting any cost model.
5. **Beta surfaces** to confirm against your installed SDK: structured outputs (client.ts) and code-execution export (engine.ts). Fallbacks carry the load if shapes differ.
6. Replace dev placeholders: outreach tokens now use `tokens.mintToken` (not `crypto.randomUUID`); add `optedOut` to schema.

## Build order (dependency-correct)

`0 scaffold → 1 data → 2 auth → 3 AI → 4 workflows → 5 portal → 6 admin/pricing/bid (after counsel) → 7 marketing/hardening`
