// Next instrumentation hook (auto-discovered). Loads the runtime-appropriate Sentry config and forwards
// React Server Component request errors to Sentry (which then runs them through the beforeSend scrub).
import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
