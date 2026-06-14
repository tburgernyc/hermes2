/**
 * Shared constants for the auth e2e suite. The admin's TOTP secret is fixed (a valid base32 string)
 * so the spec can compute live codes; global-setup seeds the matching encrypted secret. These are
 * throwaway test credentials, never real secrets.
 */
export const E2E_ORG_SLUG = "e2e-org";
export const E2E_ADMIN_EMAIL = "admin@e2e.test";
export const E2E_ADMIN_PASSWORD = "admin-Password-123!";
export const E2E_VENDOR_EMAIL = "vendor@e2e.test";
export const E2E_VENDOR_PASSWORD = "vendor-Password-123!";
/** A valid base32 TOTP secret (the canonical RFC test vector). */
export const E2E_ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
