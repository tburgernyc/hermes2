// Sentry server runtime init (loaded by instrumentation.ts in the nodejs runtime). Disabled (no-op) when
// no DSN is set — the default in dev + the public CI. The DSN is not a secret (it identifies a project);
// the secret scrub + RLS-drop live in lib/sentry-scrub.ts (CLAUDE.md §4 + §7).
import * as Sentry from "@sentry/nextjs";

import { makeBeforeSend } from "./lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: makeBeforeSend(),
});
