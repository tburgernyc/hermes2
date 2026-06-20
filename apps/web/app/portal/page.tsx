import type { JSX } from "react";

import { Card, PageHeader } from "@/components/ui/console";
import { requireVendor } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

/**
 * Vendor portal landing. Middleware already gates this; requireVendor is defense in depth. force-dynamic
 * because the rendered linkage state (linked vs. pending) depends on the session vendorId — a static
 * cache could show a freshly-linked vendor a stale "pending vetting" message.
 */
export default async function PortalHome(): Promise<JSX.Element> {
  const session = await requireVendor();
  return (
    <main>
      <PageHeader title="Subcontractor Portal" lede={`Signed in as ${session.user.email}.`} />
      <Card>
        <p data-testid="vendor-link">
          {session.user.vendorId
            ? `Vendor account linked (${session.user.vendorId}).`
            : "Account pending vetting — an administrator must link your account before you can submit quotes."}
        </p>
      </Card>
    </main>
  );
}
