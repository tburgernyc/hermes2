import type { JSX } from "react";

import { requireVendor } from "@/lib/auth-guard";

/** Vendor portal landing. Middleware already gates this; requireVendor is defense in depth. */
export default async function PortalHome(): Promise<JSX.Element> {
  const session = await requireVendor();
  return (
    <main>
      <h1>Subcontractor Portal</h1>
      <p>Signed in as {session.user.email}.</p>
    </main>
  );
}
