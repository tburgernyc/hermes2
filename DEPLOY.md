# DEPLOY.md — Hermes 2.0 (Fly.io)

Exact, copy-paste operator runbook for **Tim**. `flyctl`, `docker`, and `gh` are
**not** installed in the Claude Code build env — every command below is run by a
human from a normal terminal at the **repo root** (`hermes2/`).

Verified against the current Fly docs (June 2026):
- App config schema: <https://fly.io/docs/reference/configuration/>
- Autostop/autostart + `min_machines_running`: <https://fly.io/docs/launch/autostop-autostart/>
- Deploy with a Dockerfile: <https://fly.io/docs/languages-and-frameworks/dockerfile/>

---

## 0. One-time prerequisites

```bash
# Install flyctl (macOS/Linux). See https://fly.io/docs/flyctl/install/
curl -L https://fly.io/install.sh | sh

# Log in (opens a browser).
fly auth login

# Confirm you're in the right place: this dir must contain fly.toml + Dockerfile.
ls fly.toml Dockerfile
```

> The repo already ships a committed `fly.toml` (app `hermes2`, region `iad`,
> `min_machines_running = 1`). Do **not** run `fly launch` from scratch — it
> would overwrite that file. Use the create-then-deploy path below.

---

## 1. Create the app (registers the name; does NOT deploy)

```bash
# Creates the app record for the name pinned in fly.toml, in your default org.
# (If you have multiple orgs, add: --org <your-org-slug>)
fly apps create hermes2
```

If `hermes2` is already taken globally, pick a unique name, then update the
`app = "..."` line in `fly.toml` and pass `-a <newname>` to the commands below.

<details>
<summary>Alternative: <code>fly launch --no-deploy</code> (only if fly.toml did NOT exist)</summary>

```bash
# Generates a fly.toml by scanning the repo, then stops before deploying.
# Skip this — we already have a hand-tuned fly.toml. If you ever do run it,
# answer "No" when asked to overwrite the existing config, or diff the result.
fly launch --no-deploy --name hermes2 --region iad --dockerfile Dockerfile
```
</details>

---

## 2. Set runtime secrets from your local `.env` (never committed)

`.env` is gitignored (`.gitignore` + `.dockerignore`) and is **never** baked into
the image. Secrets are injected at runtime via Fly's encrypted secret store.

> CRITICAL (CLAUDE.md §4): these are the **app runtime** keys.
> `ANTHROPIC_API_KEY` must live ONLY in Fly secrets (prod) and your local
> gitignored `.env` (dev). **Never `export ANTHROPIC_API_KEY` in the shell that
> launches Claude Code** — that bills per-token against the API key instead of
> your Max subscription. Setting it with `fly secrets set` (below) is fine; that
> only writes to Fly, it does not export anything into your shell.

**Bulk import the whole `.env` in one call** (recommended — sets all keys at once
and triggers a single rolling restart). This reads the file; it does not export
the vars into your interactive shell:

```bash
# Imports every KEY=VALUE line from .env into Fly's secret store.
fly secrets import < .env
```

Or set them individually (use this for rotating one key without touching others). This is the
**complete** runtime set — every key here mirrors `.env.example`; the trailing comments flag the
load-bearing ones for Phase-7c go-live:

```bash
fly secrets set \
  ANTHROPIC_API_KEY="..." \
  VOYAGE_API_KEY="..." \
  DATABASE_URL="..." \
  DATABASE_URL_UNPOOLED="..." \
  MIGRATION_DATABASE_URL="..." \
  AUTH_SECRET="$(openssl rand -base64 33)" \
  AUTH_URL="https://hermes2.fly.dev" \
  TOTP_ENCRYPTION_KEY="..." \
  TOKEN_SIGNING_SECRET="..." \
  INNGEST_EVENT_KEY="..." \
  INNGEST_SIGNING_KEY="..." \
  HERMES_ACTIVE_ORG_IDS="..." \
  HEARTBEAT_URL="..." \
  APP_BASE_URL="https://burgergov.com" \
  OUTREACH_FROM="Burger Consulting <opportunities@burgergov.com>" \
  OUTREACH_POSTAL_ADDRESS="..." \
  RESEND_API_KEY="..." \
  TIGRIS_ENDPOINT="https://fly.storage.tigris.dev" \
  TIGRIS_REGION="auto" \
  TIGRIS_BUCKET="..." \
  TIGRIS_ACCESS_KEY_ID="..." \
  TIGRIS_SECRET_ACCESS_KEY="..." \
  SAM_API_KEY="..." \
  SENTRY_DSN="..." \
  NEXT_PUBLIC_SENTRY_DSN="..."

# Verify which secrets exist (shows names + digests only, never values):
fly secrets list
```

> **`MIGRATION_DATABASE_URL` is REQUIRED for go-live (Phase 7c).** The Fly `[deploy] release_command`
> runs DB migrations as this **owner** DSN before the new release takes traffic (see §7). Without it the
> release command fails fast (`MIGRATION_DATABASE_URL … is required`) and the deploy aborts — by design.
>
> **`HERMES_ACTIVE_ORG_IDS`** must be the seeded firm-org UUID (resolve it per §7) or the Inngest crons +
> the public contact form's `firmOrgId()` have nothing to operate on.
>
> **CI-only — NEVER `fly secrets`:** `NEON_API_KEY`, `NEON_PROJECT_ID`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
> `SENTRY_PROJECT` live in **GitHub Actions secrets only** (they must never reach the running app — §4/§7).
> `PORT` is set in `fly.toml [env]`, not a secret.

> **Sentry env (§6).** `SENTRY_DSN` (server/edge) + `NEXT_PUBLIC_SENTRY_DSN` (browser) are the SAME DSN
> value — it is **not** a secret (it ships in the client bundle by design); leave both unset to disable
> Sentry. `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` (sourcemap upload) belong in **GitHub
> Actions secrets ONLY — never `fly secrets`** (they must never reach the running app).

> `PORT` is intentionally **not** a secret — it's set in `fly.toml [env]` so the
> Next.js standalone server binds `0.0.0.0:3000`. `AUTH_URL` should be the real
> public URL once known (`https://hermes2.fly.dev`, or the custom domain later).

---

## 3. Deploy

```bash
# Builds the image FROM the Dockerfile (build context = repo root, so the pnpm
# lockfile + every workspace manifest are present for --frozen-lockfile) and
# rolls it out to Fly Machines.
fly deploy
```

Useful flags:
- `fly deploy --remote-only` — build on Fly's builders (no local Docker needed).
- `fly deploy --local-only` — build with your local Docker daemon.

---

## 4. Confirm the URL responds

```bash
# Print app status + the public hostname.
fly status

# Open it in a browser.
fly apps open            # -> https://hermes2.fly.dev

# Or check from the CLI (expect HTTP/2 200):
curl -I https://hermes2.fly.dev
```

Tail logs if it doesn't come up:

```bash
fly logs
```

---

## 5. Open the PR (Phase 0 handoff)

`gh` is not in the Claude Code env, so the operator opens the PR:

```bash
# From the feature branch (NOT main).
git push -u origin <your-branch>

gh pr create \
  --base main \
  --title "Phase 0: scaffold + CI + Fly deploy skeleton" \
  --body "$(cat <<'EOF'
## Summary
Phase 0 — monorepo scaffold, CI gate, and Fly Machines deploy skeleton.

- Next.js 15 standalone Dockerfile (Node 22, pnpm 9, non-root, port 3000)
- fly.toml: app=hermes2, region=iad, force_https, auto_start, min_machines_running=1
- SessionStart hook (.claude/settings.json + .claude/hooks/session-start.sh)
- DEPLOY.md operator runbook

## Test plan
- [ ] CI green: typecheck / lint / test / build / gitleaks / audit
- [ ] `fly deploy` succeeds and `curl -I https://hermes2.fly.dev` returns 200
- [ ] `fly secrets list` shows all runtime keys (no values in repo)
EOF
)"
```

After the PR is green and Fly responds, mark Phase 0 acceptance criteria done in
`PROJECT_PLAN.md` and merge.

---

## 6. Production hardening — Sentry + external heartbeat (Phase 7b)

### Sentry (error monitoring)

1. Create a Sentry project (platform: Next.js). Copy its **DSN**.
2. Set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` (same DSN) via `fly secrets` (see §2). With no DSN, Sentry
   is a clean no-op — safe to defer.
3. For readable stack traces, add **`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`** as **GitHub
   Actions repo secrets** (Settings → Secrets → Actions). The build uploads source maps only when the
   token is present; it is **CI-only and must never be a Fly secret** (it must not reach the app).
4. Verify: trigger a test error after deploy and confirm it appears in Sentry **with secrets/PII scrubbed**
   (no `ANTHROPIC_API_KEY`/`DATABASE_URL`/emails) and that RLS/`42501` errors are **absent** (dropped by
   design — they are security signals, visible in `fly logs`, not alerts). See `apps/web/lib/sentry-scrub.ts`.

### External dead-man's-switch (the app cannot alert on its own outage)

The `cron-heartbeat` Inngest function pings `HEARTBEAT_URL` every ~10 minutes. You must point that at an
**external** monitor so an outage is caught even when the app (and its own alerting) is down:

1. Create a **cron/heartbeat monitor** at [healthchecks.io](https://healthchecks.io) (free) — or
   cronitor.io / Better Stack. Set the **period to 10 min** and the **grace to ~5 min** (alert if no ping
   for ~15 min).
2. Copy its ping URL into `HEARTBEAT_URL` (`fly secrets set HEARTBEAT_URL="https://hc-ping.com/<uuid>"`).
   The heartbeat requires `https://`.
3. Add a notification channel (email / SMS / Slack) on that monitor. Verify: confirm a ping lands within
   10 min of deploy, then (optionally) pause the app briefly and confirm the monitor alerts.

### Liveness probe

`GET /api/health` returns `{"status":"ok"}` (dependency-free — liveness, not readiness). As of **Phase 7c**
the Fly health check that hits it is **wired** (`fly.toml [[http_service.checks]]`, 30s interval, 10s grace)
— the proxy routes traffic to a Machine only once it passes, and flags one that starts failing. Verify:

```bash
curl -s https://hermes2.fly.dev/api/health   # -> {"status":"ok"}
# Spot-check the security headers + CSP are present:
curl -sI https://hermes2.fly.dev/ | grep -iE "content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy"
```

---

## 7. Go-live (Phase 7c) — migrations, checklist, verification, rollback

Phase 7c wires the production **DB-migration step** into the deploy and ships the Fly health check. Read this
section in full before the first Tier-1 deploy.

### 7.1 How production migrations run (`[deploy] release_command`)

`fly.toml` declares:

```toml
[deploy]
  release_command = "node /app/migrator/dist/migrate.js"
```

On every `fly deploy`, Fly runs that command in a **one-off Machine** built from the new image **before any
new Machine takes traffic**. It is the SAME `migrate.ts` the CI `db`/`inngest`/`web-e2e` jobs run on every PR
— compiled (the `migrator` Docker stage) into a self-contained bundle (its own `node_modules` with
`pg`/`drizzle-orm`/`dotenv`, the built `dist/migrate.js`, and the `migrations/` SQL tree). It connects as
**`MIGRATION_DATABASE_URL`** (the Neon **owner** role) and applies, in order: extensions → roles → tables →
guards (triggers + RLS) → grants → the auth/token/vendor role migrations, then **asserts** the
`sync_line_item_contract_type` trigger is still `SECURITY DEFINER` (a security post-condition).

- **Fail-closed deploy.** A non-zero exit **aborts the deploy** — Fly does not roll the new release out and
  the previous release keeps serving. A broken or partial migration therefore never reaches production.
- **Idempotent + resumable.** Every manual step is `IF NOT EXISTS` / `OR REPLACE`; drizzle records applied
  table migrations in `__drizzle_migrations`. A retried deploy (or one with no new migrations) is a safe
  no-op. Migrations are **forward-only** — there is no down-migration (see 7.7 for a bad-migration rollback).
- **Creds stay out of CI.** `MIGRATION_DATABASE_URL` is a **Fly secret**, never a GitHub secret — prod DB
  credentials never touch CI (which runs the same migrations against throwaway pgvector containers / Neon
  branches). This is the whole reason migrations run here and not in a GitHub Actions job (CLAUDE.md §4/§7).

### 7.2 Neon roles: owner (migrations) vs. runtime (app)

Two distinct roles — never collapse them:

| Secret | Role | Used for |
|---|---|---|
| `MIGRATION_DATABASE_URL` | **owner** (`neondb_owner`; has `CREATEROLE` via `neon_superuser`) | the release_command: DDL + `REVOKE`/`GRANT` + RLS. The REVOKE/GRANT only bind when run as owner. |
| `DATABASE_URL` | **`hermes_app`** (non-owner, RLS-bound, pooled) | the app runtime. RLS attaches automatically *because* it is a non-owner. |

`migrations/manual/0001_roles.sql` creates `hermes_app`/`hermes_token` **NOLOGIN, no password** (no secrets
in the repo) and is idempotent (`IF NOT EXISTS` → CREATE). So you must, **as the owner, set the app role's
LOGIN + password out-of-band** before the app can connect as it:

```sql
-- Run once in the Neon SQL editor (or any owner connection), BEFORE the first deploy:
ALTER ROLE hermes_app WITH LOGIN PASSWORD '<strong-random>';
```

Because `0001` only CREATEs when absent, this LOGIN/password is **preserved** across every future
release_command run. Put `hermes_app:<password>@…` into `DATABASE_URL`. (The membership grants the app role
needs — `hermes_app → hermes_token / hermes_vendor / hermes_auth WITH INHERIT FALSE` — are applied by the
release_command itself, so they no longer need a separate manual confirmation step.)

**Rotate the exposed creds before go-live.** The Neon DB password and `NEON_API_KEY` were pasted in chat
during Phase 1 — rotate both (Neon console → reset role password; regenerate the API key + update the GitHub
Actions secret).

### 7.3 Resolve `HERMES_ACTIVE_ORG_IDS`

The crons + the public contact form resolve the firm org from this env (comma-separated UUIDs; single-tenant
→ one id). After the first migrate + seed, read the seeded org's id as the owner and set the secret:

```sql
SELECT id FROM orgs ORDER BY created_at LIMIT 1;   -- copy the UUID
```
```bash
fly secrets set HERMES_ACTIVE_ORG_IDS="<that-uuid>"
```

### 7.4 Branch-protection required checks

Set these as **required** status checks on `main` (Settings → Branches):

- **Required:** `build`, `db`, `web-e2e`, `inngest`, `gitleaks`.
- **NOT required** (signal only — green-when-skipped or environment-dependent): `db-acceptance` (skips
  without Neon secrets), `audit` (advisory), `docker-build` (a Docker/runner hiccup must not block a PR,
  but watch it — it is the only check that proves the deployable image assembles).

### 7.5 Pre-deploy checklist

- [ ] All **required** CI checks green on `main` (and `docker-build` green — it proves the image assembles).
- [ ] `fly secrets list` shows the full §2 set — incl. `MIGRATION_DATABASE_URL`, `DATABASE_URL`,
      `AUTH_SECRET`, `TOTP_ENCRYPTION_KEY`, `TOKEN_SIGNING_SECRET`, `HERMES_ACTIVE_ORG_IDS`, `AUTH_URL`.
- [ ] `hermes_app` has LOGIN + password (7.2); `DATABASE_URL` uses it.
- [ ] `MIGRATION_DATABASE_URL` is the **owner** DSN (7.1 / 7.2).
- [ ] Neon owner password + `NEON_API_KEY` rotated (7.2).
- [ ] `ANTHROPIC_API_KEY` is **NOT** exported in the deploy shell (CLAUDE.md §4) — `env | grep -i anthropic`
      returns nothing. `fly secrets set` it instead.
- [ ] `HEARTBEAT_URL` points at the external monitor (§6); Sentry DSN set or intentionally deferred (§6).
- [ ] `AUTH_URL` / `APP_BASE_URL` are the real public URLs.

### 7.6 Deploy + post-deploy verification

```bash
fly deploy
```

Watch the release command apply migrations, then verify:

```bash
# 1. release_command log ends with "✓ migrations complete" (else the deploy aborts — see 7.7).
fly logs | grep -E "migrations complete|release_command"

# 2. Liveness + headers (§6).
curl -s  https://hermes2.fly.dev/api/health     # -> {"status":"ok"}
curl -sI https://hermes2.fly.dev/ | grep -iE "content-security-policy|strict-transport|x-frame"

# 3. App health: the login page renders, an admin can log in + pass TOTP, /admin loads.
# 4. The external heartbeat monitor logged a ping within ~10 min (§6).
# 5. (If Sentry on) trigger one test error; confirm it appears with secrets/PII scrubbed + no 42501 (§6).
```

### 7.7 Rollback

- **Migration failed → the deploy already aborted.** The old release keeps serving; nothing to roll back.
  Fix the migration and re-deploy (idempotent, so the re-run resumes cleanly).
- **Bad code in a new release.** List releases and redeploy the prior image (the release_command re-runs,
  idempotent + safe):
  ```bash
  fly releases                       # find the prior version + image ref
  fly deploy --image <registry.fly.io/hermes2:deployment-XXXX>
  ```
- **A migration applied but is wrong** (forward-only — no down-migration). Restore the database with Neon's
  point-in-time / branch restore (Neon console → Restore), then redeploy the matching prior image. Treat
  this as the last resort; the fail-closed release_command makes it rare.

---

## Gotchas (read before first deploy)

- **`min_machines_running` vs autostop interplay.** `auto_stop_machines = "stop"`
  lets the Fly proxy stop *idle excess* Machines, but `min_machines_running = 1`
  (inside `[http_service]`) is a hard floor: Fly always keeps **one** Machine
  warm in `primary_region`. This is required so the Inngest cron scheduler never
  scales to zero. `min_machines_running` is ignored unless autostop is `"stop"`
  or `"suspend"`. To truly keep all Machines on, set `auto_stop_machines = "off"`.
- **`auto_stop_machines` is a string now**, not a bool: `"off"` / `"stop"` /
  `"suspend"` (legacy `false`/`true` still parse). We use `"stop"`.
- **Region codes** are 3-letter IATA-style (`iad` = Ashburn/US-East,
  `ord` = Chicago, `sjc` = San Jose, `lax` = Los Angeles). List them with
  `fly platform regions`. `primary_region` must be a valid code, not "US".
- **PORT binding.** The app must listen on `0.0.0.0:3000`, not `127.0.0.1`.
  The Dockerfile sets `HOSTNAME=0.0.0.0` + `PORT=3000`, and `fly.toml [env]` sets
  `PORT="3000"` and `internal_port = 3000`. If you change the port, change all
  three together or the Fly proxy health check will fail.
- **Don't re-run `fly launch`** on this repo — it can clobber the curated
  `fly.toml`. Use `fly apps create` + `fly deploy`.
- **Secrets trigger a restart.** `fly secrets set` / `fly secrets import` roll the
  Machines. Set secrets *before* (or right after) the first deploy so the app
  boots with them present; the app fails fast if required secrets are missing.
