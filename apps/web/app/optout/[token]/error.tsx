"use client";

import * as Sentry from "@sentry/nextjs";
import type { JSX } from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Card, PublicShell } from "@/components/ui/console";

/**
 * §3.2 baseline audit: Next.js App Router error boundary for the public tokenized /optout/[token] page.
 * Without this file, a thrown error fell through to the ROOT global-error.tsx. Reports to Sentry exactly
 * like global-error.tsx. Presentational only — reset() re-renders; sends nothing (CLAUDE.md §2).
 */
export default function OptoutError({
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
    <PublicShell>
      <Card>
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Your opt-out request was not recorded.</p>
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
      </Card>
    </PublicShell>
  );
}
