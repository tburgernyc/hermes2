// Sentry browser init (auto-discovered). Reads the PUBLIC DSN (embedded in the client bundle by design);
// disabled (no-op) when unset. Session Replay is OFF (it would capture vendor/visitor PII). The same
// beforeSend scrub + RLS-drop as the server runs here too.
import * as Sentry from "@sentry/nextjs";

import { makeBeforeSend } from "./lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: makeBeforeSend(),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
