/**
 * Drizzle query surface, re-exported from the package that OWNS the drizzle-orm instance.
 *
 * Why this exists: under pnpm, a consumer package that also depends on drizzle-orm can resolve a SECOND
 * physical copy (e.g. when a transitive dep like `inngest` → `@opentelemetry/api` shifts drizzle's
 * optional-peer resolution hash). Operators imported from that second copy produce `SQL<unknown>` types
 * that are nominally incompatible with the table objects exported here — the "separate declarations of a
 * private property 'shouldInlineParams'" error. Routing every consumer's operators through @hermes/db
 * guarantees a single type identity. Import `eq`, `and`, `sql`, … from "@hermes/db", never "drizzle-orm".
 */
export {
  and,
  or,
  not,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  like,
  ilike,
  between,
  asc,
  desc,
  count,
  sql,
} from "drizzle-orm";
