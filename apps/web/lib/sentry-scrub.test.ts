import { describe, expect, it } from "vitest";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";

import { isRlsError, makeBeforeSend, scrubEvent } from "./sentry-scrub";

const REDACTED = "[redacted]";

function baseEvent(over: Partial<ErrorEvent> = {}): ErrorEvent {
  return { type: undefined, ...over } as ErrorEvent;
}

describe("isRlsError", () => {
  it("detects an RLS violation by message", () => {
    const event = baseEvent({
      exception: { values: [{ type: "error", value: "new row violates row-level security policy" }] },
    });
    expect(isRlsError(event)).toBe(true);
  });

  it("detects the 42501 SQLSTATE on the original exception", () => {
    const hint = { originalException: Object.assign(new Error("denied"), { code: "42501" }) } as EventHint;
    expect(isRlsError(baseEvent(), hint)).toBe(true);
  });

  it("does not flag an ordinary error", () => {
    const event = baseEvent({ exception: { values: [{ type: "TypeError", value: "x is not a function" }] } });
    expect(isRlsError(event)).toBe(false);
  });
});

describe("makeBeforeSend", () => {
  const beforeSend = makeBeforeSend();

  it("DROPS RLS-violation events (security signal, not a bug)", () => {
    const event = baseEvent({
      exception: { values: [{ type: "error", value: "permission denied for table vendor_quotes" }] },
    });
    expect(beforeSend(event, {} as EventHint)).toBeNull();
  });

  it("returns a scrubbed event for ordinary errors", () => {
    const event = baseEvent({ message: "boom" });
    const out = beforeSend(event, {} as EventHint);
    expect(out).not.toBeNull();
    expect(out?.message).toBe("boom");
  });

  it("DROPS events whose ORIGINAL exception carries the 42501 SQLSTATE (RLS via hint)", () => {
    const event = baseEvent({ exception: { values: [{ type: "Error", value: "query failed" }] } });
    const hint = {
      originalException: Object.assign(new Error("query failed"), { code: "42501" }),
    } as EventHint;
    expect(beforeSend(event, hint)).toBeNull();
  });
});

describe("scrubEvent", () => {
  it("redacts secret-keyed values in extra/contexts and request headers", () => {
    const event = baseEvent({
      extra: { ANTHROPIC_API_KEY: "sk-ant-xxx", DATABASE_URL: "postgres://u:p@h/db", note: "fine" },
      request: { headers: { authorization: "Bearer abc", cookie: "session=zzz", "x-ok": "fine" } },
      contexts: { app: { AUTH_SECRET: "hunter2", build: "123" } },
    });
    const out = scrubEvent(event);
    expect(out.extra?.ANTHROPIC_API_KEY).toBe(REDACTED);
    expect(out.extra?.DATABASE_URL).toBe(REDACTED);
    expect(out.extra?.note).toBe("fine");
    const headers = out.request?.headers as Record<string, string>;
    expect(headers.authorization).toBe(REDACTED);
    expect(headers.cookie).toBe(REDACTED);
    expect(headers["x-ok"]).toBe("fine");
    expect((out.contexts?.app as Record<string, string>).AUTH_SECRET).toBe(REDACTED);
  });

  it("masks emails in messages, exceptions, and breadcrumbs (PII)", () => {
    const event = baseEvent({
      message: "failed for vendor@example.com",
      exception: { values: [{ type: "error", value: "no quote from sub@contractor.io" }] },
      breadcrumbs: [{ message: "sent to buyer@agency.gov" }],
    });
    const out = scrubEvent(event);
    expect(out.message).toBe(`failed for ${REDACTED}`);
    expect(out.exception?.values?.[0]?.value).toBe(`no quote from ${REDACTED}`);
    expect(out.breadcrumbs?.[0]?.message).toBe(`sent to ${REDACTED}`);
  });

  it("drops user identity PII (email / ip / username)", () => {
    const event = baseEvent({ user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4", username: "tim" } });
    const out = scrubEvent(event);
    expect(out.user?.id).toBe("u1");
    expect(out.user?.email).toBeUndefined();
    expect(out.user?.ip_address).toBeUndefined();
    expect(out.user?.username).toBeUndefined();
  });

  it("redacts the request cookies string", () => {
    const event = baseEvent({ request: { cookies: { session: "zzz", csrf: "abc" } } });
    expect(scrubEvent(event).request?.cookies).toBe(REDACTED);
  });

  it("redacts secrets NESTED deep inside extra (recursive scrub)", () => {
    const event = baseEvent({ extra: { config: { db: { DATABASE_URL: "postgres://x" }, ok: "y" } } });
    const config = scrubEvent(event).extra?.config as Record<string, Record<string, unknown>>;
    expect(config.db?.DATABASE_URL).toBe(REDACTED);
    expect(config.ok).toBe("y");
  });

  it("redacts secret-keyed values nested inside a breadcrumb data record", () => {
    const event = baseEvent({
      breadcrumbs: [
        { message: "db call", data: { DATABASE_URL: "postgres://u:p@h/db", query: "SELECT 1" } },
      ],
    });
    const data = scrubEvent(event).breadcrumbs?.[0]?.data as Record<string, unknown>;
    expect(data.DATABASE_URL).toBe(REDACTED);
    expect(data.query).toBe("SELECT 1");
  });

  it("redacts secret-keyed fields in an object request body (request.data)", () => {
    const event = baseEvent({
      request: { data: { password: "hunter2", username: "tim", note: "ok" } as unknown as string },
    });
    const data = scrubEvent(event).request?.data as unknown as Record<string, unknown>;
    expect(data.password).toBe(REDACTED);
    expect(data.note).toBe("ok");
  });

  it("does NOT mutate the input event (immutability)", () => {
    const event = baseEvent({ user: { email: "a@b.com" }, extra: { API_KEY: "secret" } });
    scrubEvent(event);
    expect(event.user?.email).toBe("a@b.com"); // original untouched
    expect(event.extra?.API_KEY).toBe("secret");
  });
});
