/**
 * /admin/inquiries — the public contact-form inbox. Read surface + one human "mark reviewed" decision.
 * Rendering advances nothing and sends nothing (CLAUDE.md §2); requireAdmin guards the page. Untrusted
 * visitor text (name / company / message) is rendered as DATA via JSX autoescape, never as markup.
 */
import type { JSX } from "react";

import { contactInquiries, desc, eq, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
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
      <PageHeader title="Contact inquiries" lede={`${inquiries.length} total · ${newCount} new`} />

      {inquiries.length === 0 ? (
        <p className={c.empty}>No inquiries yet.</p>
      ) : (
        <ul className={c.list} data-testid="inquiries-list">
          {inquiries.map((i) => (
            <Card as="li" key={i.id} testId={`inquiry-${i.id}`}>
              <div className={c.rowBetween}>
                <div>
                  <strong>{i.name}</strong> · {i.email}
                  {i.company ? <div className={c.metaMono}>{i.company}</div> : null}
                </div>
                <div className={c.row}>
                  <Badge tone="info">{i.intent}</Badge>
                  <Badge tone={i.status === "NEW" ? "warn" : "neutral"}>{i.status}</Badge>
                  <span className={c.meta}>{i.createdAt.toISOString().slice(0, 10)}</span>
                </div>
              </div>
              <blockquote className={c.inquiryQuote}>{i.message}</blockquote>
              {i.status === "NEW" && (
                <form action={markInquiryReviewed}>
                  <input type="hidden" name="inquiryId" value={i.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Mark reviewed
                  </Button>
                </form>
              )}
            </Card>
          ))}
        </ul>
      )}
    </main>
  );
}
