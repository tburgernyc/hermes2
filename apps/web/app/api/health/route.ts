/**
 * Liveness probe (CLAUDE.md §7). A dependency-free 200 used by the Fly health check (wired in Phase 7c),
 * the external heartbeat verification, and Sentry/deploy smoke checks. Intentionally does NOT touch the
 * DB: liveness ≠ readiness — a brief DB blip must not flap the machine. force-dynamic so it is never
 * statically cached.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ status: "ok" });
}
