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

Or set them individually (use this for rotating one key without touching others):

```bash
fly secrets set \
  ANTHROPIC_API_KEY="..." \
  VOYAGE_API_KEY="..." \
  DATABASE_URL="..." \
  AUTH_SECRET="$(openssl rand -base64 33)" \
  AUTH_URL="https://hermes2.fly.dev" \
  TOKEN_SIGNING_SECRET="..." \
  INNGEST_EVENT_KEY="..." \
  INNGEST_SIGNING_KEY="..." \
  RESEND_API_KEY="..." \
  TIGRIS_BUCKET="..." \
  TIGRIS_ACCESS_KEY_ID="..." \
  TIGRIS_SECRET_ACCESS_KEY="..." \
  SAM_API_KEY="..." \
  SENTRY_DSN="..." \
  NEXT_PUBLIC_SENTRY_DSN="..."

# Verify which secrets exist (shows names + digests only, never values):
fly secrets list
```

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

`GET /api/health` returns `{"status":"ok"}` (dependency-free — liveness, not readiness). The Fly health
check that hits it is wired in **Phase 7c** (`fly.toml [http_service.checks]`); until then verify manually:

```bash
curl -s https://hermes2.fly.dev/api/health   # -> {"status":"ok"}
# Spot-check the security headers + CSP are present:
curl -sI https://hermes2.fly.dev/ | grep -iE "content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy"
```

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
