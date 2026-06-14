import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing (argon2id)", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored).not.toContain("correct horse"); // never plaintext
    expect(await verifyPassword(stored, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(stored, "wrong password")).toBe(false);
  });

  it("produces a distinct hash per call (random salt) that still verifies", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "same")).toBe(true);
    expect(await verifyPassword(b, "same")).toBe(true);
  });

  it("fails closed on a garbage stored hash", async () => {
    expect(await verifyPassword("not-a-valid-argon2-hash", "whatever")).toBe(false);
  });
});
