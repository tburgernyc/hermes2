"use client";

import * as Sentry from "@sentry/nextjs";
import type { JSX } from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/console";

/**
 * §3.2 baseline audit: Next.js App Router error boundary for every page under /portal. Without this file,
 * any thrown error fell through to the ROOT global-error.tsx, which replaces the entire document — losing
 * the vendor AppNav and forcing a full reload. This boundary is scoped to the portal layout, so the AppNav
 * (rendered by the layout ABOVE this boundary) stays mounted and the subcontractor can navigate straight
 * out via it, or retry in place. Reports to Sentry exactly like global-error.tsx. Presentational only —
 * reset() re-renders; it fetches no new data itself and sends nothing (CLAUDE.md §2).
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main>
      <PageHeader
        title="Something went wrong"
        lede="This page hit an unexpected error. Nothing was submitted or changed — your data is unaffected."
      />
      <Card>
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
      </Card>
    </main>
  );
}
