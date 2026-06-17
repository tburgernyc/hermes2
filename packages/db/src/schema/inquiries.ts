/**
 * Public marketing contact inquiries (Phase 7a). An inbound lead a visitor submits from the public
 * /contact form — the firm's own org-scoped row, NOT a vendor/prospect/workflow record. It NEVER
 * advances any firm state and triggers NO outbound (CLAUDE.md §2): the admin reads it and follows up
 * by hand (status NEW → REVIEWED). The public write goes through hermes_app via withOrg(firmOrgId)
 * — the same precedent as the public /invite accept (a public write that needs more than the token
 * role allows) — gated by Zod validation + rate limiting + same-origin CSRF in the Server Action.
 */
import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { inquiryIntent, inquiryStatus } from "./enums.js";
import { timestamps, uuidPk } from "./_shared.js";
import { orgs } from "./tenancy.js";

export const contactInquiries = pgTable(
  "contact_inquiries",
  {
    id: uuidPk(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    email: text("email").notNull(), // validated by Zod at the action boundary (not a DB regex)
    company: text("company"),
    intent: inquiryIntent("intent").notNull().default("OTHER"),
    message: text("message").notNull(),
    status: inquiryStatus("status").notNull().default("NEW"),
    ...timestamps(),
  },
  (t) => [
    index("contact_inquiries_org_idx").on(t.orgId),
    index("contact_inquiries_status_idx").on(t.status),
    // Belt for the boundary Zod: a stored inquiry must carry a non-empty name and message.
    check(
      "contact_inquiries_text_present",
      sql`length(btrim(${t.name})) > 0 AND length(btrim(${t.message})) > 0`,
    ),
  ],
);
