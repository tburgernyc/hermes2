"use client";

import * as Sentry from "@sentry/nextjs";
import type { JSX } from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { AuthScreen } from "@/components/ui/AuthScreen";

/**
 * §3.2 baseline audit: Next.js App Router error boundary for the public tokenized /invite/[token]
 * onboarding page. Without this file, a thrown error fell through to the ROOT global-error.tsx. Reports to
 * Sentry exactly like global-error.tsx. Presentational only — reset() re-renders; sends nothing (§2).
 */
export default function InviteError({
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
    <AuthScreen title="Something went wrong">
      <p>An unexpected error occurred. Your account was not created.</p>
      <Button type="button" onClick={() => reset()} block>
        Try again
      </Button>
    </AuthScreen>
  );
}
