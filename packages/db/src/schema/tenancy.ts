/**
 * Tenancy cluster: orgs (tenant root), users (auth + RBAC), audit_log (append-only / immutable).
 * Every business row is org-scoped; child tables FK to (org_id, id) so cross-tenant parentage is
 * impossible even independent of RLS (CLAUDE.md §6 multi-tenant; §7 audit_log).
 */
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { actorType, userRole } from "./enums.js";
import { timestamps, uuidPk } from "./_shared.js";
import type { OrgDirectives } from "../directives.js";

/**
 * Tenant root. Intentionally referenced single-column (orgs.id is the PK) — do NOT add a redundant
 * unique(org_id, id). FK target for every org_id; holds the firm's compliance config as validated JSONB.
 */
export const orgs = pgTable(
  "orgs",
  {
    id: uuidPk(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ein: varchar("ein", { length: 10 }),
    uei: varchar("uei", { length: 12 }),
    cageCode: varchar("cage_code", { length: 5 }), // null until CAGE finalized
    primaryDomain: text("primary_domain"),
    /** Firm directives + compliance config — Zod-validated at the boundary (see directives.ts). */
    directives: jsonb("directives").$type<OrgDirectives>().notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("orgs_slug_key").on(t.slug),
    check("orgs_uei_format", sql`${t.uei} IS NULL OR ${t.uei} ~ '^[A-Z0-9]{12}$'`),
    check("orgs_cage_format", sql`${t.cageCode} IS NULL OR ${t.cageCode} ~ '^[A-Z0-9]{5}$'`),
    check("orgs_ein_format", sql`${t.ein} IS NULL OR ${t.ein} ~ '^[0-9]{2}-?[0-9]{7}$'`),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash"), // argon2id; required for admins (CHECK)
    role: userRole("role").notNull().default("VENDOR"),
    /** AES-256-GCM ciphertext (never plaintext). Admin enrollment enforced at the app layer. */
    totpSecretCiphertext: text("totp_secret_ciphertext"),
    totpEnrolledAt: timestamp("totp_enrolled_at", { withTimezone: true, mode: "date" }),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique("users_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`),
    index("users_org_idx").on(t.orgId),
    check(
      "users_admin_requires_password",
      sql`${t.role} <> 'ADMIN' OR ${t.passwordHash} IS NOT NULL`,
    ),
  ],
);

/**
 * Append-only. A row is written on every autonomous action and every approval. UPDATE/DELETE/TRUNCATE
 * are blocked by triggers + REVOKE (Stage 2). No updated_at by design.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id"),
    actorType: actorType("actor_type").notNull(),
    /** Email snapshot for non-repudiation if the user row is later deactivated/removed. */
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"), // soft reference (not an FK — entity may be any table)
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    // Block deleting a user while audit rows reference them (history preservation — CLAUDE.md §7).
    foreignKey({
      name: "audit_log_actor_fk",
      columns: [t.orgId, t.actorUserId],
      foreignColumns: [users.orgId, users.id],
    }).onDelete("restrict"),
    index("audit_log_org_idx").on(t.orgId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_created_idx").on(t.createdAt),
    // Every non-system action must be attributable (user id and/or email snapshot for non-repudiation).
    check(
      "audit_log_attributable",
      sql`${t.actorType} = 'SYSTEM' OR ${t.actorUserId} IS NOT NULL OR ${t.actorEmail} IS NOT NULL`,
    ),
  ],
);
