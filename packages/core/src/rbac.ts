/** Trust roles and the shared auth error type for the server-side boundary (CLAUDE.md §7). */

/** Session role. The DB `user_role` enum is UPPERCASE; normalize to this with `toRole`. */
export type Role = "admin" | "vendor";

/** Thrown by the auth guards; carries the HTTP status a Route Handler should return. */
export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const isAdmin = (role: Role): boolean => role === "admin";
export const isVendor = (role: Role): boolean => role === "vendor";

/** Normalize the DB `user_role` enum (ADMIN/VENDOR) to the session Role (admin/vendor). */
export function toRole(dbRole: "ADMIN" | "VENDOR"): Role {
  return dbRole === "ADMIN" ? "admin" : "vendor";
}
