import type { JSX } from "react";

import { AuthScreen } from "@/components/ui/AuthScreen";

/**
 * §3.2 baseline audit: Next.js App Router route-level Suspense fallback for the public tokenized
 * /invite/[token] onboarding page. Presentational only — no data fetch, no state change (CLAUDE.md §2).
 */
export default function InviteLoading(): JSX.Element {
  return (
    <AuthScreen title="One moment">
      <p>Loading…</p>
    </AuthScreen>
  );
}
