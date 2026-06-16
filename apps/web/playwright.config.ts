import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

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

// The app under test connects with the migration-owner DSN for e2e.
const ownerDsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (ownerDsn) process.env.DATABASE_URL = ownerDsn;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Cold-start headroom: the first tests run while the standalone server is still JIT/RSC-warming, and the
  // admin login helper may re-drive the TOTP step-up a few times (see loginAdmin). 30s (the default) is too
  // tight under that contention; 60s keeps real hangs bounded without flaking on a cold machine.
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: BASE_URL },
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
