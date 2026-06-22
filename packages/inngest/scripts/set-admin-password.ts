/**
 * Set / reset an ADMIN user's password directly in the database (operator-run). The seeded admin is
 * created with a non-login sentinel hash and there is no admin self-service password reset, so this is
 * the supported way to give the admin a real, login-able password before the first sign-in.
 *
 * It connects as the OWNER (`MIGRATION_DATABASE_URL`) because `password_hash` is writable only by the
 * owner — the runtime `hermes_app` / `hermes_auth` roles deliberately cannot set it. The new password is
 * read from the env (`ADMIN_NEW_PASSWORD`) and hashed with the same argon2id helper the app uses; the
 * plaintext is NEVER printed or logged.
 *
 * Run it WITHOUT exposing the value to this shell — type it yourself with the `!` prefix:
 *
 *     ADMIN_NEW_PASSWORD='choose-a-strong-passphrase' \
 *       pnpm --filter @hermes/inngest exec tsx scripts/set-admin-password.ts
 *
 * Optional: ADMIN_EMAIL=other@admin (defaults to the seeded admin). After it succeeds, sign in at
 * /login with the email + new password; the app walks you through TOTP enrollment (QR) on first sign-in.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../..", ".env") });

import { hashPassword } from "@hermes/core";

const log = (s = ""): void => {
  // eslint-disable-next-line no-console
  console.log(s);
};

const MIN_LEN = 12;

async function main(): Promise<void> {
  const dsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!dsn) {
    log("❌ MIGRATION_DATABASE_URL (owner DSN) is required to set password_hash.");
    process.exitCode = 1;
    return;
  }
  const email = (process.env.ADMIN_EMAIL ?? "t.burgernyc@gmail.com").trim();
  const pw = process.env.ADMIN_NEW_PASSWORD;
  if (!pw || pw.length < MIN_LEN) {
    log(`❌ set ADMIN_NEW_PASSWORD (>= ${MIN_LEN} chars). The value is never printed.`);
    process.exitCode = 1;
    return;
  }

  const hash = await hashPassword(pw);
  const pool = new Pool({ connectionString: dsn });
  try {
    const res = await pool.query(
      `UPDATE users
         SET password_hash = $1, failed_login_count = 0, locked_until = NULL
       WHERE lower(email) = lower($2) AND role = 'ADMIN'
       RETURNING id, email`,
      [hash, email],
    );
    if (res.rowCount === 0) {
      log(`❌ no ADMIN user with email ${email} — check ADMIN_EMAIL (run db:seed if the org is fresh).`);
      process.exitCode = 1;
      return;
    }
    log(`✅ password set for admin ${res.rows[0].email} (${res.rows[0].id}). Lockout counters cleared.`);
    log("   Sign in at /login → you'll be walked through TOTP enrollment (QR) on first sign-in.");
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  log(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
