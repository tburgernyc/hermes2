import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

import { E2E_ORG_ID } from "./e2e/fixtures";

const here = dirname(fileURLToPath(import.meta.url));
// Load repo-root .env for local runs; CI provides the env directly.
dotenv.config({ path: resolve(here, "../../.env") });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Deterministic test secrets (never real). Set on process.env BEFORE global-setup + webServer so the
// secret encrypted in global-setup is decryptable by the running app (same TOTP_ENCRYPTION_KEY).
process.env.TOTP_ENCRYPTION_KEY ??= Buffer.alloc(32, 9).toString("base64");
process.env.AUTH_SECRET ??= "e2e-auth-secret-please-change-0123456789";
process.env.TOKEN_SIGNING_SECRET ??= "e2e-token-signing-secret-0123456789abcd";
// No Tigris in e2e/CI: the tokenized upload path uses the in-memory storage driver (explicit opt-in).
process.env.STORAGE_DRIVER ??= "memory";
process.env.AUTH_URL = BASE_URL;
// The public /contact form resolves the firm org from HERMES_ACTIVE_ORG_IDS; point it at the e2e org
// (seeded with this fixed id in global-setup). Set BEFORE defineConfig so it is captured in webServer.env.
process.env.HERMES_ACTIVE_ORG_IDS ??= E2E_ORG_ID;

// The app under test connects with the migration-owner DSN for e2e.
const ownerDsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (ownerDsn) process.env.DATABASE_URL = ownerDsn;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // CI retries ride out the DOCUMENTED cold-start flake (CLAUDE.md §11 PR-G note): next-auth v5's
  // unstable_update intermittently fails to PERSIST the refreshed session cookie on a cold/contended
  // standalone server, so an admin TOTP step-up can bounce /admin → /admin/totp for a sustained window —
  // the warmup reduces but does not eliminate it. A retry re-runs the flaked test (incl. its beforeAll
  // warmup) in a later, better window. A GENUINE auth break still fails every attempt (and auth.spec's
  // single-attempt admin login stays the regression canary), so this never masks a real failure. Local
  // stays 0 to surface flakes during development. Real fix (deferred, Phase-2 auth): harden /admin/totp
  // against the cookie-persist race so retries become unnecessary.
  retries: process.env.CI ? 2 : 0,
  // Cold-start headroom: the first tests run while the standalone server is still JIT/RSC-warming, and the
  // admin login helper may re-drive the TOTP step-up several times with backoff (see loginAdmin). 30s (the
  // default) is too tight under that contention; 90s keeps real hangs bounded without flaking on a cold
  // machine. (The beforeAll warmup sets its own longer timeout to establish warmth up front.)
  timeout: 90_000,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "pnpm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...(process.env as Record<string, string>),
      PORT: String(PORT),
    },
  },
});
