import type { JSX } from "react";

import { Card, PublicShell } from "@/components/ui/console";
import c from "@/components/ui/console.module.css";

/**
 * §3.2 baseline audit: Next.js App Router route-level Suspense fallback for the public tokenized
 * /quote/[token] page. Presentational only — no data fetch, no state change (CLAUDE.md §2).
 */
export default function QuoteLoading(): JSX.Element {
  return (
    <PublicShell>
      <Card>
        <p className={c.empty}>Loading…</p>
      </Card>
    </PublicShell>
  );
}
