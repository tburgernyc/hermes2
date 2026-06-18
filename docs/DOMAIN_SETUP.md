# Custom domain setup — `burgergov.com` (step-by-step)

A complete, ordered walkthrough to point the public site at **`burgergov.com`** (apex canonical;
`www.burgergov.com` redirects to it). DNS is hosted at **Zoho**; the Fly app is **`hermes2`**.

> **How to read this file without losing it to terminal scrollback:**
> - `less docs/DOMAIN_SETUP.md` — scroll with ↑/↓ / PageUp / PageDown, `q` to quit, `/text` to search.
> - or open it in your editor (e.g. `code docs/DOMAIN_SETUP.md`), or read it on GitHub.

Run commands from a normal terminal at the repo root. `<…>` = a value you copy from command output.
This is the conversational companion to **DEPLOY.md §7.8** (the in-runbook version).

---

## Phase 0 — One-time prerequisites (confirm these are true)

1. Fly CLI installed + logged in:
   ```bash
   fly auth whoami        # should print t.burgernyc@gmail.com
   ```
2. You're on current `main`:
   ```bash
   git checkout main && git pull
   ```
3. Decision (already made): apex `burgergov.com` is canonical; `www` redirects to it.

---

## Phase 1 — Get the CURRENT build live on Fly (prerequisite)

> The app on `hermes2.fly.dev` is a **stale Jun-14 image** (before the marketing site existed). If you point
> the domain at it now, visitors get the old stub. Redeploy current `main` first. Full secret list + detail:
> **DEPLOY.md §2 and §7**. Essentials:

4. Set the runtime secrets (once). Load-bearing ones (see DEPLOY.md §2 for the complete list):
   ```bash
   fly secrets set \
     MIGRATION_DATABASE_URL="<Neon OWNER dsn>" \
     DATABASE_URL="<Neon hermes_app dsn>" \
     AUTH_SECRET="$(openssl rand -base64 33)" \
     AUTH_URL="https://hermes2.fly.dev" \
     TOTP_ENCRYPTION_KEY="<32-byte key>" \
     TOKEN_SIGNING_SECRET="<32+ chars>" \
     HERMES_ACTIVE_ORG_IDS="<seeded org UUID>" \
     -a hermes2
   ```
   - Set `AUTH_URL="https://hermes2.fly.dev"` **for now** so admin login works while you test on the fly.dev
     host. You switch it to the apex in **Step 15**.
   - Also set the other app secrets per DEPLOY.md §2: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TIGRIS_*`,
     `SAM_API_KEY`, `SENTRY_DSN`, `HEARTBEAT_URL`, etc.
   - One-time in Neon (DEPLOY.md §7.2): `ALTER ROLE hermes_app WITH LOGIN PASSWORD '…';` and use that in
     `DATABASE_URL`.

5. Deploy (runs DB migrations via the release_command before traffic):
   ```bash
   fly deploy
   ```
6. Confirm the real site is live on the Fly host:
   ```bash
   curl -s  https://hermes2.fly.dev/api/health     # {"status":"ok"}
   curl -sI https://hermes2.fly.dev | head         # 200 + security headers
   ```
   Open `https://hermes2.fly.dev` in a browser — you should see the **BurgerGov marketing homepage**, not a
   stub. Don't continue until this is the real site.

---

## Phase 2 — Make `burgergov.com`'s DNS live at Zoho

> Right now `burgergov.com` returns **NXDOMAIN** — it isn't resolving anywhere yet.

7. Log in at **zoho.com** → open the **Domains** console → select **`burgergov.com`** → **Manage DNS**.
   Confirm the domain is active and its nameservers are Zoho's (e.g. `ns1.zoho.com` / `ns2.zoho.com`). If it
   was just registered, complete any pending verification so the zone goes live.
8. Verify from your terminal before going further:
   ```bash
   host -t NS burgergov.com        # or: nslookup -type=NS burgergov.com
   ```
   You must see Zoho nameservers. **Do not proceed until this resolves.**

---

## Phase 3 — Give Fly a dedicated IPv4 (the apex needs it)

9. Check current IPs:
   ```bash
   fly ips list -a hermes2
   ```
   You already have a **dedicated IPv6** (free). If there's no **dedicated v4** line (only "shared"),
   allocate one (~$2/mo — the apex must be an `A` record to a stable IP; Zoho can't CNAME the apex):
   ```bash
   fly ips allocate-v4 -a hermes2
   ```
10. Note the two values you'll need: the **dedicated IPv4** and the **IPv6**.

---

## Phase 4 — Provision the certificates on Fly

11. Tell Fly about both hostnames:
    ```bash
    fly certs add burgergov.com -a hermes2
    fly certs add www.burgergov.com -a hermes2
    ```
12. Re-print exactly what Fly wants (run anytime):
    ```bash
    fly certs show burgergov.com -a hermes2
    fly certs show www.burgergov.com -a hermes2
    ```
    These show the `A`/`AAAA` for the apex, the `www` CNAME target, and the two `_acme-challenge` CNAME
    values. **This is the best moment to paste the output to Claude for the exact Zoho rows.**

---

## Phase 5 — Add the DNS records in Zoho

13. **Zoho → Domains → `burgergov.com` → Manage DNS → Manage Records.** Add these (use `@` — or a blank host
    — for the apex; **TTL 300** during cutover):

    | Host / Name | Type | Value |
    |---|---|---|
    | `@` | A | `<dedicated Fly IPv4 from Step 9>` |
    | `@` | AAAA | `<Fly IPv6 from Step 9>` |
    | `_acme-challenge` | CNAME | `<value from "fly certs show burgergov.com">` |
    | `www` | CNAME | `hermes2.fly.dev` |
    | `_acme-challenge.www` | CNAME | `<value from "fly certs show www.burgergov.com">` |

    ⚠️ **Leave existing MX / TXT (SPF/DKIM/Zoho-verification) records untouched** — email is unaffected. Only
    ADD these web records. Save.

---

## Phase 6 — Wait for the certs to issue, then flip the canonical URL

14. Poll until issued (minutes to ~an hour, depending on DNS propagation):
    ```bash
    fly certs check burgergov.com -a hermes2
    fly certs check www.burgergov.com -a hermes2
    ```
    Both should reach **"Issued" / "Ready"**. Fly auto-issues Let's Encrypt certs once it sees the records.
15. Make the apex canonical in the app (only after the apex cert is issued):
    ```bash
    fly secrets set AUTH_URL="https://burgergov.com" APP_BASE_URL="https://burgergov.com" -a hermes2
    ```
    This restarts the app. (`AUTH_URL` must match the public domain or admin login + CSRF break.)

---

## Phase 7 — Verify end-to-end

16. ```bash
    curl -sI https://burgergov.com      | head    # 200 + security headers
    curl -sI https://www.burgergov.com  | head    # 308, location: https://burgergov.com/
    curl -s  https://burgergov.com/api/health      # {"status":"ok"}
    ```
17. In a browser: `https://burgergov.com` loads the marketing site with a valid padlock;
    `https://www.burgergov.com` redirects to the apex; admin login works at `https://burgergov.com/login`.

---

## Phase 8 — Cleanup

18. Remove the stray old scaffold app (after confirming it's unused):
    ```bash
    fly apps destroy hermes2-web
    ```

---

## Troubleshooting

- **Still NXDOMAIN** → the Zoho zone/nameservers aren't live yet (Phase 2).
- **Cert stuck "awaiting configuration"** → an `A`/`AAAA`/`_acme-challenge` value doesn't match
  `fly certs show`; re-check the exact values.
- **Zoho won't accept a CNAME on the apex** → expected/correct; the apex is `A`+`AAAA`, only `www` is a CNAME.
- **Login fails on the domain** → `AUTH_URL` isn't `https://burgergov.com` (Step 15).
- **Site shows old/stub content** → the app isn't the current build; redo Phase 1.
