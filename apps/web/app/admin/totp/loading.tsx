import type { JSX } from "react";

import { AuthScreen } from "@/components/ui/AuthScreen";

/**
 * §3.2 baseline audit: Next.js App Router route-level Suspense fallback for /admin/totp and
 * /admin/totp/enroll (outside the (console) route group, so it does NOT inherit that group's loading.tsx).
 * Presentational only — no data fetch, no state change (CLAUDE.md §2).
 */
export default function TotpLoading(): JSX.Element {
  return (
    <AuthScreen title="One moment">
      <p>Loading…</p>
    </AuthScreen>
  );
}
