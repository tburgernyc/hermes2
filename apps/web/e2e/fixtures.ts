/**
 * Shared constants for the auth e2e suite. The admin's TOTP secret is fixed (a valid base32 string)
 * so the spec can compute live codes; global-setup seeds the matching encrypted secret. These are
 * throwaway test credentials, never real secrets.
 */
export const E2E_ORG_SLUG = "e2e-org";
/**
 * Fixed org id for the e2e org. The public /contact form resolves the firm org from
 * HERMES_ACTIVE_ORG_IDS (no session/token to carry one), so the seeded org must have a KNOWN id that
 * playwright.config can hand to the running server. CI always runs against a fresh DB, so the id is
 * created exactly; a stale local DB with a different-id e2e-org would only affect the contact test.
 */
export const E2E_ORG_ID = "e2e00000-0000-4000-8000-0000000000e2";
export const E2E_ADMIN_EMAIL = "admin@e2e.test";
export const E2E_ADMIN_PASSWORD = "admin-Password-123!";
export const E2E_VENDOR_EMAIL = "vendor@e2e.test";
export const E2E_VENDOR_PASSWORD = "vendor-Password-123!";
/** A valid base32 TOTP secret (the canonical RFC test vector). */
export const E2E_ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
