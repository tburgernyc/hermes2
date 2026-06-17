// Sentry edge runtime init (loaded by instrumentation.ts in the edge runtime — middleware, edge routes).
// Same disabled-without-DSN + scrub posture as the server config. lib/sentry-scrub.ts is edge-safe (pure
// strings + structuredClone, no Node APIs).
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
