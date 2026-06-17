/**
 * /admin/inquiries — the public contact-form inbox. Read surface + one human "mark reviewed" decision.
 * Rendering advances nothing and sends nothing (CLAUDE.md §2); requireAdmin guards the page. Untrusted
 * visitor text (name / company / message) is rendered as DATA via JSX autoescape, never as markup.
 */
import type { JSX } from "react";

import { contactInquiries, desc, eq, withOrg } from "@hermes/db";

import { requireAdmin } from "@/lib/auth-guard";

import { markInquiryReviewed } from "./actions";

export const dynamic = "force-dynamic";

export default async function InquiriesPage(): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;

  const inquiries = await withOrg(orgId, (tx) =>
    tx
      .select({
        id: contactInquiries.id,
        name: contactInquiries.name,
        email: contactInquiries.email,
        company: contactInquiries.company,
        intent: contactInquiries.intent,
        message: contactInquiries.message,
        status: contactInquiries.status,
        createdAt: contactInquiries.createdAt,
      })
      .from(contactInquiries)
      .where(eq(contactInquiries.orgId, orgId))
      .orderBy(desc(contactInquiries.createdAt))
      .limit(200),
  );

  const newCount = inquiries.filter((i) => i.status === "NEW").length;

  return (
    <main>
      <h1>Contact inquiries</h1>
      <p>
        {inquiries.length} total · {newCount} new
      </p>

      {inquiries.length === 0 ? (
        <p>No inquiries yet.</p>
      ) : (
        <ul data-testid="inquiries-list">
          {inquiries.map((i) => (
            <li key={i.id} data-testid={`inquiry-${i.id}`}>
              <strong>{i.name}</strong> · {i.email}
              {i.company ? ` · ${i.company}` : ""} · {i.intent} · {i.status} ·{" "}
              {i.createdAt.toISOString().slice(0, 10)}
              <blockquote>{i.message}</blockquote>
              {i.status === "NEW" && (
                <form action={markInquiryReviewed} style={{ display: "inline" }}>
                  <input type="hidden" name="inquiryId" value={i.id} />
                  <button type="submit">Mark reviewed</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
