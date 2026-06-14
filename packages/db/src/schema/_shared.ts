/**
 * Shared column helpers. Each helper returns a FRESH column builder per call so the same builder
 * instance is never shared across tables.
 */
import { numeric, timestamp, uuid, vector } from "drizzle-orm/pg-core";

/** Embedding dimension — MUST match the Voyage model (voyage-3.5 = 1024). Pinned in one place. */
export const EMBED_DIM = 1024;

/** UUID primary key, server-generated via gen_random_uuid() (Postgres 16 core). */
export const uuidPk = () => uuid("id").defaultRandom().primaryKey();

/**
 * Standard created/updated timestamps (timestamptz). `updated_at` is maintained authoritatively by a
 * shared BEFORE UPDATE trigger (Stage 2) — not by ORM `$onUpdate`, which raw SQL/seed/Inngest bypass.
 */
export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** A pgvector embedding column at the project-wide dimension (cosine ops, HNSW indexed per table). */
export const embedding = (name: string) => vector(name, { dimensions: EMBED_DIM });

/** USD money column: numeric(14,2). Non-negativity is enforced per-table via CHECK. */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
