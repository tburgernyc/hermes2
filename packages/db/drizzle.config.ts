import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config. Migrations are GENERATED here, but APPLIED as the migration OWNER
 * (MIGRATION_DATABASE_URL) via src/migrate.ts so REVOKE/GRANT on the runtime role actually bind.
 * `generate` runs offline; the dbCredentials below are only used by push/introspect.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url:
      process.env.MIGRATION_DATABASE_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "",
  },
  strict: true,
  verbose: true,
});
