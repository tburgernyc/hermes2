/**
 * Playwright global setup: migrate a (throwaway) database, then upsert the e2e org + an enrolled admin
 * (known password + fixed TOTP secret) and a vendor. Runs against the migration-owner DSN; the app
 * under test connects with the same DSN (RLS faithfulness is covered by @hermes/db's `db` CI job —
 * here we exercise the auth boundary). All writes are idempotent so the suite can re-run.
 */
import { execSync } from "node:child_process";
import { Pool } from "pg";
import { encryptSecret, hashPassword } from "@hermes/core";

import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_TOTP_SECRET,
  E2E_ORG_SLUG,
  E2E_VENDOR_EMAIL,
  E2E_VENDOR_PASSWORD,
} from "./fixtures";

export default async function globalSetup(): Promise<void> {
  const dsn = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!dsn) {
    throw new Error(
      "e2e global-setup: set MIGRATION_DATABASE_URL or DATABASE_URL_UNPOOLED to a Postgres DSN.",
    );
  }

  // Idempotent migrate: extensions → roles → tables → guards → grants → hermes_auth role.
  execSync("pnpm --filter @hermes/db db:migrate", { stdio: "inherit" });

  const pool = new Pool({ connectionString: dsn });
  try {
    const org = await pool.query<{ id: string }>(
      `INSERT INTO orgs (slug, name, directives) VALUES ($1, 'E2E Org', '{}'::jsonb)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [E2E_ORG_SLUG],
    );
    const orgId = org.rows[0]?.id;
    if (!orgId) throw new Error("e2e global-setup: failed to upsert org");

    const [adminHash, vendorHash] = await Promise.all([
      hashPassword(E2E_ADMIN_PASSWORD),
      hashPassword(E2E_VENDOR_PASSWORD),
    ]);
    const totpCiphertext = encryptSecret(E2E_ADMIN_TOTP_SECRET);

    const adminRow = await pool.query<{ id: string }>(
      `INSERT INTO users
         (org_id, email, role, password_hash, totp_secret_ciphertext, totp_enrolled_at, is_active)
       VALUES ($1, $2, 'ADMIN', $3, $4, now(), true)
       ON CONFLICT (lower(email)) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         totp_secret_ciphertext = EXCLUDED.totp_secret_ciphertext,
         totp_enrolled_at = EXCLUDED.totp_enrolled_at,
         is_active = true, failed_login_count = 0, locked_until = NULL
       RETURNING id`,
      [orgId, E2E_ADMIN_EMAIL, adminHash, totpCiphertext],
    );
    const adminId = adminRow.rows[0]?.id;
    if (!adminId) throw new Error("e2e global-setup: failed to upsert admin");

    await pool.query(
      `INSERT INTO users (org_id, email, role, password_hash, is_active)
       VALUES ($1, $2, 'VENDOR', $3, true)
       ON CONFLICT (lower(email)) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         is_active = true, failed_login_count = 0, locked_until = NULL`,
      [orgId, E2E_VENDOR_EMAIL, vendorHash],
    );

    // Link the seeded vendor user to a VETTED vendor so the login flow exercises the full
    // DB → session vendorId path (the PR-C linkage). Idempotent: create the vendor once, then bind it.
    await pool.query(
      `INSERT INTO vendors (org_id, company_name, status, vetted_by, vetted_at)
       SELECT $1, 'E2E Vendor Co', 'VETTED', $2, now()
       WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE org_id = $1 AND company_name = 'E2E Vendor Co')`,
      [orgId, adminId],
    );
    const vendorRow = await pool.query<{ id: string }>(
      `SELECT id FROM vendors WHERE org_id = $1 AND company_name = 'E2E Vendor Co' LIMIT 1`,
      [orgId],
    );
    const vendorId = vendorRow.rows[0]?.id;
    if (!vendorId) throw new Error("e2e global-setup: failed to upsert vendor");
    const linkRow = await pool.query<{ id: string }>(
      `UPDATE users SET vendor_id = $1
       WHERE org_id = $2 AND lower(email) = lower($3) AND role = 'VENDOR'
       RETURNING id`,
      [vendorId, orgId, E2E_VENDOR_EMAIL],
    );
    if (!linkRow.rows[0]?.id) {
      throw new Error("e2e global-setup: failed to link vendor user (UPDATE matched 0 rows)");
    }
  } finally {
    await pool.end();
  }
}
