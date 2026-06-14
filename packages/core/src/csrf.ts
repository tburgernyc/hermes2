/**
 * Same-origin enforcement for custom Route Handlers. Next.js Server Actions already carry built-in
 * CSRF/origin protection; raw Route Handlers (/api/*) do NOT — call this first on every mutating one
 * (CLAUDE.md §7: "all mutations … enforce same-origin CSRF").
 */
import { AuthError } from "./rbac.js";

function allowedHost(): string {
  return new URL(process.env.AUTH_URL ?? "http://localhost:3000").host;
}

/** Throw AuthError(403) unless the request's Origin (or Referer) host matches AUTH_URL's host. */
export function assertSameOrigin(req: Request): void {
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) throw new AuthError(403, "Missing Origin/Referer header");
  let host: string;
  try {
    host = new URL(source).host;
  } catch {
    throw new AuthError(403, "Malformed Origin/Referer header");
  }
  if (host !== allowedHost()) throw new AuthError(403, "Cross-origin request denied");
}
