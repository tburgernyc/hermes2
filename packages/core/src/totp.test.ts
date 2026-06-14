import { authenticator } from "otplib";
import { beforeAll, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, generateTotpSecret, totpKeyUri, verifyTotpCode } from "./totp.js";

beforeAll(() => {
  // Deterministic 32-byte key (base64) for AES-256-GCM in the test.
  process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("TOTP", () => {
  it("verifies a freshly generated code and rejects a wrong one", () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(verifyTotpCode(secret, wrong)).toBe(false);
  });

  it("builds an otpauth key URI with the issuer", () => {
    const uri = totpKeyUri("admin@burgergov.com", generateTotpSecret());
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("Hermes");
  });

  it("round-trips the secret through AES-256-GCM and detects tampering", () => {
    const secret = generateTotpSecret();
    const ciphertext = encryptSecret(secret);
    expect(ciphertext).not.toContain(secret);
    expect(decryptSecret(ciphertext)).toBe(secret);

    const [iv, tag] = ciphertext.split(".");
    const tampered = [iv, tag, Buffer.from("tampered-bytes").toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
