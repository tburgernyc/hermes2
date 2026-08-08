import type { JSX } from "react";

import { Card } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";

/**
 * §3.2 baseline audit: Next.js App Router route-level Suspense fallback for every page under /portal (home,
 * open RFQs, my quotes + detail, my subcontracts, my documents, quote submission). Without this file,
 * navigating between force-dynamic portal pages shows nothing between the click and the next paint — this
 * fills that gap. Presentational only: no data fetch, no state change (CLAUDE.md §2).
 */
export default function PortalLoading(): JSX.Element {
  return (
    <main aria-busy="true" aria-live="polite">
      <Card>
        <p className={c.empty}>Loading…</p>
      </Card>
    </main>
  );
}
