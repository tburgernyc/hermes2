# Hermes 2.0 — BurgerGov PMO

AI-assisted federal IT-contracting PMO for **Burger Consulting LLC** (`burgergov.com`). It sources federal
IT solicitations from SAM.gov, triages them against the firm's go/no-go criteria, discovers and vets
subcontractors, drafts outreach, intakes and evaluates subcontractor quotes, produces a pricing
decision-brief, and drafts a compliant bid — all as **decision-support software with a human operator**,
never an autonomous agent.

> **The Prime Directive.** The AI never takes an outbound or state-advancing action on its own. Every action
> that contacts a third party, advances workflow state, or commits the business is a *recommendation* that
> pauses for explicit human approval, enforced structurally via durable-workflow approval gates
> (`step.waitForEvent`). See [CLAUDE.md](./CLAUDE.md) §2.

## Status

Build phases 0–7 are code-complete and merged to `main`; post-build console/marketing UI work continues on
`burgergov-ui`. Everything ships `pendingCounsel` — the no-auto-submit + counsel-review gates structurally
block any live bid submission until a government-contracts attorney signs off and `readyForLiveSubmission`
passes. See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the phase map and CLAUDE.md §11 for the per-phase log.

## Stack

| Layer | Choice |
|---|---|
| Language / build | TypeScript, pnpm + Turborepo monorepo, `strict` everywhere |
| Web + API | Next.js 15 (App Router, Server Actions, Route Handlers) |
| AI engine | Anthropic TypeScript SDK; Voyage AI for embeddings |
| Background work | Inngest (crons + durable `waitForEvent` human-gate workflows) |
| Database | Neon Postgres (RLS tenant isolation) + pgvector; Drizzle ORM/migrations |
| Auth | Auth.js v5 + RBAC (`admin`, `vendor`) + TOTP for admin |
| Hosting / infra | Fly.io Machines; Tigris (S3-compatible) storage; Resend email; Sentry |

## Repo layout

```
apps/web/          Next.js 15 (marketing + admin + portal + token pages + /api/inngest)
packages/db/       Drizzle schema, migrations, RLS guards, seed
packages/ai/       Anthropic SDK wrappers (triage, score, evaluate, draft, export) + fallbacks
packages/core/     domain logic, workflow state machine, auth/RBAC/TOTP helpers
packages/inngest/  Inngest functions (crons + approval workflows) + connectors
packages/emails/   React Email templates
e2e/ (apps/web)    Playwright
```

## Running locally

### Prerequisites

- **Node 22** and **pnpm 9** (`corepack enable`).
- A populated repo-root **`.env`** (gitignored). Start from [`.env.example`](./.env.example). The app will
  not boot without at least `DATABASE_URL`, `AUTH_SECRET`, `TOTP_ENCRYPTION_KEY`, and `TOKEN_SIGNING_SECRET`.

### 1. Install

```bash
pnpm install
```

### 2. Make Next load the root `.env` — one-time, required

`next dev` runs inside `apps/web` and only auto-loads env files from **that** directory, not the repo root
(the packages load the root `.env` via `dotenv`, but Next does not). Symlink the root `.env` in so Next and
the auth middleware can read the secrets:

```bash
ln -sfn ../../.env apps/web/.env.local    # .env.local is gitignored — no secret-commit risk
```

Without this you'll see `[auth][error] MissingSecret` in the server log and every `/admin` + `/portal`
route will fail (the public marketing pages still render).

### 3. Start

```bash
pnpm --filter @hermes/web dev
```

Open **http://localhost:3000**. A healthy boot logs `Environments: .env.local` and **no** `MissingSecret`;
`/admin` and `/portal` should `307 → /login` when unauthenticated.

> Database migrations and seed data are managed separately — `pnpm --filter @hermes/db migrate` and
> `pnpm --filter @hermes/db seed`. For the full end-to-end walk (real SAM.gov + AI + human gates, with a
> sandboxed safe-stop submit) see [docs/live-test-runbook.md](./docs/live-test-runbook.md).

### Running on a remote box? Tunnel port 3000

If the dev server runs on a **remote VM you reach over SSH** (not your laptop), `next dev` binds to *that
box's* `localhost:3000` — so `http://localhost:3000` in your laptop browser has nothing to connect to and
returns `ERR_CONNECTION_REFUSED`. Plain SSH (unlike VS Code Remote / Codespaces) does **not** auto-forward
ports. Open a local port-forward from your laptop, then browse `http://localhost:3000`:

```bash
# one-off — run on your LAPTOP in a separate terminal; leave it running
ssh -N -L 3000:localhost:3000 <ssh-user>@<vm-host>
# …or, on GCP:
gcloud compute ssh <instance> --zone <zone> -- -N -L 3000:localhost:3000
```

To make it persistent, add a host block to your laptop's `~/.ssh/config`:

```ssh-config
Host hermes-dev
    HostName <vm-host>          # e.g. the VM's external IP
    User <ssh-user>
    LocalForward 3000 localhost:3000
```

Then `ssh -N hermes-dev` forwards the port automatically and `http://localhost:3000` on your laptop reaches
the VM. The tunnel rides your existing SSH (port 22) connection — **no firewall change needed** — and keeps
the browser origin as `localhost:3000`, which is what Auth.js expects for login cookies, CSRF, and TOTP
callbacks (hitting the VM's IP directly would break those). Your own literal VM host/user live in the
gitignored `LOCAL_LOGIN.md`.

## Accessing the app — accounts & login

| Surface | Routes | Auth |
|---|---|---|
| Public marketing site | `/`, `/capabilities`, `/about`, `/contact`, `/privacy`, `/terms` | none |
| **Admin console** | `/admin/**` | ADMIN user — password **+ TOTP step-up** |
| **Vendor portal** | `/portal/**` | VENDOR user — password (no TOTP) |

Only the **admin** role requires a TOTP second factor — use any authenticator app (Google Authenticator,
1Password, Authy, …). Vendors do not.

**Where the credentials live (kept out of git on purpose):**

- **Throwaway test accounts** — a seeded admin and a linked vendor in the *E2E Org*, defined in
  [`apps/web/e2e/fixtures.ts`](./apps/web/e2e/fixtures.ts) (gitleaks-allowlisted test values, never real
  secrets). The admin's TOTP secret there is a fixed base32 test vector you can add to an authenticator app
  to generate live codes.
- **Your local dev logins** — including the real *Burger Consulting* admin (`t.burgernyc@gmail.com`) — are
  kept in a **gitignored `LOCAL_LOGIN.md`** at the repo root, so live values never enter version control.

**First admin login (self-enroll TOTP):** sign in with the admin email + password → you are routed to
`/admin/totp`, which shows a **QR code** → scan it with your authenticator app → enter the 6-digit code.
Later logins just need a fresh code.

**Set / reset a dev admin password** (the DB-seeded admin ships with a non-usable reset sentinel until you
set a real password). Do this against the **owner** DSN (`MIGRATION_DATABASE_URL`, which bypasses RLS), and
**never commit the value**:

```text
# Hash the password with @hermes/core `hashPassword()` (argon2id), then:
UPDATE users
   SET password_hash = <hash>, failed_login_count = 0, locked_until = NULL
 WHERE lower(email) = lower('<admin-email>') AND role = 'ADMIN';
```

> **Cold-start note:** on a freshly-started dev server the TOTP step-up can occasionally bounce back to
> `/admin/totp` once (a known next-auth `unstable_update` session-cookie race). Re-enter a fresh code — it
> settles once the server is warm.

## Testing

```bash
pnpm turbo typecheck lint test build     # full local gate (mirrors CI)
pnpm --filter @hermes/web test:e2e       # Playwright: auth, marketing, portal, admin console
```

## Documentation

| Doc | What it covers |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Operating contract — Prime Directive, locked stack, security non-negotiables, per-phase log |
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | Master build plan / phase map |
| [BUILD_INDEX.md](./BUILD_INDEX.md) | Index of the build phases and PR record |
| [DEPLOY.md](./DEPLOY.md) | Fly.io production deploy runbook (secrets, migrations, health check, rollback) |
| [docs/live-test-runbook.md](./docs/live-test-runbook.md) | End-to-end live SAM → AI → human-gates walk with a sandboxed safe-stop submit |
| [docs/DOMAIN_SETUP.md](./docs/DOMAIN_SETUP.md) | Custom domain / DNS setup for `burgergov.com` |
| [docs/compliance/counsel-compliance-brief.md](./docs/compliance/counsel-compliance-brief.md) | Provisional FAR/SBA compliance & pricing baseline (pending counsel) |
| [LAWYER_BRIEFING.md](./LAWYER_BRIEFING.md) | Counsel briefing for the federal-contracting system |
| [design/readme.md](./design/readme.md) | BurgerGov design system / UI kits |

## Security

Secrets are **never** committed: production secrets live in `fly secrets`, CI secrets are GitHub Actions
secrets, and local secrets live in a gitignored `.env`. gitleaks runs in CI and only allowlists the
throwaway test credentials under `apps/web/e2e/*`, `apps/web/playwright.config.ts`, and
`packages/inngest/test/*`. See CLAUDE.md §7 for the full security posture (RLS tenant isolation, the
tokenized vendor boundary, operator-only AI column grants, CSP/headers, rate-limiting, audit log).
