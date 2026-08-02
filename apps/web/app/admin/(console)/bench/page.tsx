/**
 * /admin/bench — §3.8.2 proactive vendor-bench building. An "add to bench" form (no solicitation field
 * anywhere — independent of any specific opportunity) plus a searchable/filterable directory of every
 * vendor on file, by NAICS code and/or capability keyword. Vetting itself still happens at /admin/vendors
 * (this page does not duplicate that queue — it links into it). requireAdmin guards the page.
 */
import Link from "next/link";
import type { JSX } from "react";

import { and, desc, eq, ilike, or, vendors, withOrg } from "@hermes/db";

import { Badge, Card, PageHeader, Section } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { humanizeStatus } from "@/lib/admin-board";
import { extractNaicsCodes, stripNaicsTag } from "@/lib/bench";
import { requireAdmin } from "@/lib/auth-guard";

import { addVendorToBench } from "./actions";

export const dynamic = "force-dynamic";

export default async function BenchPage({
  searchParams,
}: {
  searchParams: Promise<{ naics?: string; q?: string }>;
}): Promise<JSX.Element> {
  const session = await requireAdmin();
  const orgId = session.user.orgId;
  const { naics, q } = await searchParams;
  const naicsFilter = (naics ?? "").trim();
  const qFilter = (q ?? "").trim();

  const bench = await withOrg(orgId, async (tx) => {
    const conditions = [eq(vendors.orgId, orgId)];
    // NAICS filter: substring match against the tagged capabilities text (see lib/bench.ts — vendors has
    // no dedicated structured naicsCodes column; a future schema PR should add one for exact filtering).
    if (naicsFilter.length > 0) {
      conditions.push(ilike(vendors.capabilitiesText, `%${naicsFilter}%`));
    }
    if (qFilter.length > 0) {
      const term = `%${qFilter}%`;
      const clause = or(ilike(vendors.companyName, term), ilike(vendors.capabilitiesText, term));
      if (clause) conditions.push(clause);
    }
    return tx
      .select({
        id: vendors.id,
        companyName: vendors.companyName,
        contactEmail: vendors.contactEmail,
        status: vendors.status,
        capabilitiesText: vendors.capabilitiesText,
        promotedFromProspectId: vendors.promotedFromProspectId,
      })
      .from(vendors)
      .where(and(...conditions))
      .orderBy(desc(vendors.createdAt))
      .limit(200);
  });

  return (
    <main>
      <PageHeader
        title="Vendor bench"
        lede="Proactively add and tag vendors by NAICS/capability BEFORE any specific opportunity — independent of any solicitation. Vetting happens at /admin/vendors."
      />

      <Section title="Add to bench">
        <Card>
          <form action={addVendorToBench}>
            <Field label="Company" name="companyName" required maxLength={200} />
            <Field label="Email" name="contactEmail" type="email" />
            <Field label="UEI" name="uei" maxLength={12} />
            <Field label="NAICS" name="naicsCodes" placeholder="541511, 541512" />
            <Field label="Capabilities" name="capabilitiesText" />
            <Button type="submit">Add to bench</Button>
          </form>
        </Card>
      </Section>

      <Section title="Search the bench">
        <Card>
          <form method="get">
            <Field label="NAICS code" name="naics" defaultValue={naicsFilter} placeholder="541511" />
            <Field label="Capability keyword" name="q" defaultValue={qFilter} placeholder="cloud migration" />
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            {(naicsFilter.length > 0 || qFilter.length > 0) && (
              <Link href="/admin/bench" className={c.crumb}>
                Clear filters
              </Link>
            )}
          </form>
        </Card>
      </Section>

      <Section title="Bench directory" count={bench.length}>
        {bench.length === 0 ? (
          <p className={c.empty}>No vendors match.</p>
        ) : (
          <ul className={c.list}>
            {bench.map((v) => {
              const tags = extractNaicsCodes(v.capabilitiesText);
              const description = stripNaicsTag(v.capabilitiesText);
              return (
                <Card as="li" key={v.id} size="sm" testId={`bench-vendor-${v.id}`}>
                  <div className={c.rowBetween}>
                    <div>
                      <strong>{v.companyName}</strong>
                      {v.contactEmail ? ` · ${v.contactEmail}` : ""}
                      <div className={c.row}>
                        <Badge>{humanizeStatus(v.status)}</Badge>
                        {!v.promotedFromProspectId && <Badge tone="info">Bench-added</Badge>}
                        {tags.map((t) => (
                          <Badge key={t} tone="neutral">
                            NAICS {t}
                          </Badge>
                        ))}
                      </div>
                      {description && <p className={c.meta}>{description}</p>}
                    </div>
                    <Link href="/admin/vendors" className={c.crumb}>
                      Vet →
                    </Link>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </Section>
    </main>
  );
}
