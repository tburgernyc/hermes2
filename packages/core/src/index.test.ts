import { describe, expect, it } from "vitest";

import { AuthError, isAdmin, isVendor, toRole } from "./rbac.js";

describe("rbac", () => {
  it("normalizes the DB user_role enum to the session role", () => {
    expect(toRole("ADMIN")).toBe("admin");
    expect(toRole("VENDOR")).toBe("vendor");
  });

  it("evaluates role predicates", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("vendor")).toBe(false);
    expect(isVendor("vendor")).toBe(true);
    expect(isVendor("admin")).toBe(false);
  });

  it("AuthError carries the HTTP status and name", () => {
    const e = new AuthError(403, "nope");
    expect(e.status).toBe(403);
    expect(e.name).toBe("AuthError");
    expect(e).toBeInstanceOf(Error);
  });
});
