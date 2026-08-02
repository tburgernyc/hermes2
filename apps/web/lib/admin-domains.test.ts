/**
 * §3.6 granular admin RBAC — pure unit tests for the ONE decision function both middleware.ts and the
 * page/action guard primitives (`requireAdminDomain` et al. in auth-guard.ts) read. No session/DB mocking
 * needed: `isAdminDomainAllowed` is the entire enforcement decision, so exhaustively testing it here IS
 * testing the enforcement — these are the negative tests DoD item 2 calls for (CAPTURE denied on
 * /admin/settings actions AND on financial writes [= the FINANCE domain, the guard the future invoices/
 * payables/timekeeping actions will use]; FINANCE denied on sourcing/outreach/proposal actions [= the
 * CAPTURE domain]; FULL unchanged).
 */
import { describe, expect, it } from "vitest";

import { domainForPath, isAdminDomainAllowed, type AdminRole } from "./admin-domains";

const ROLES: readonly AdminRole[] = ["FULL", "CAPTURE", "FINANCE"];

describe("isAdminDomainAllowed", () => {
  it("OPEN is reachable by every admin level, and by a null/undefined role (dashboard + audit log)", () => {
    for (const role of ROLES) expect(isAdminDomainAllowed(role, "OPEN")).toBe(true);
    expect(isAdminDomainAllowed(null, "OPEN")).toBe(true);
    expect(isAdminDomainAllowed(undefined, "OPEN")).toBe(true);
  });

  it("FULL reaches every domain — current behavior, unchanged", () => {
    expect(isAdminDomainAllowed("FULL", "SETTINGS")).toBe(true);
    expect(isAdminDomainAllowed("FULL", "CAPTURE")).toBe(true);
    expect(isAdminDomainAllowed("FULL", "FINANCE")).toBe(true);
  });

  it("CAPTURE is denied SETTINGS (/admin/settings + /admin/users actions)", () => {
    expect(isAdminDomainAllowed("CAPTURE", "SETTINGS")).toBe(false);
  });

  it("CAPTURE is denied FINANCE (the guard the future financial-write actions use)", () => {
    expect(isAdminDomainAllowed("CAPTURE", "FINANCE")).toBe(false);
  });

  it("CAPTURE is allowed its own domain (solicitations/proposals/outreach)", () => {
    expect(isAdminDomainAllowed("CAPTURE", "CAPTURE")).toBe(true);
  });

  it("FINANCE is denied CAPTURE (sourcing/outreach/proposal-drafting actions)", () => {
    expect(isAdminDomainAllowed("FINANCE", "CAPTURE")).toBe(false);
  });

  it("FINANCE is denied SETTINGS", () => {
    expect(isAdminDomainAllowed("FINANCE", "SETTINGS")).toBe(false);
  });

  it("FINANCE is allowed its own domain", () => {
    expect(isAdminDomainAllowed("FINANCE", "FINANCE")).toBe(true);
  });

  it("fails CLOSED on a null/undefined admin_role for every non-OPEN domain (never an implicit FULL)", () => {
    for (const domain of ["SETTINGS", "CAPTURE", "FINANCE"] as const) {
      expect(isAdminDomainAllowed(null, domain)).toBe(false);
      expect(isAdminDomainAllowed(undefined, domain)).toBe(false);
    }
  });
});

describe("domainForPath", () => {
  it("maps /admin/settings and its sub-paths to SETTINGS", () => {
    expect(domainForPath("/admin/settings")).toBe("SETTINGS");
    expect(domainForPath("/admin/settings/anything")).toBe("SETTINGS");
  });

  it("maps /admin/users (the admin-role-assignment surface) to SETTINGS", () => {
    expect(domainForPath("/admin/users")).toBe("SETTINGS");
  });

  it("maps the solicitations/vendors/prospects/approvals/inquiries trees to CAPTURE", () => {
    expect(domainForPath("/admin/solicitations")).toBe("CAPTURE");
    expect(domainForPath("/admin/solicitations/abc-123/proposal")).toBe("CAPTURE");
    expect(domainForPath("/admin/solicitations/abc-123/subcontract")).toBe("CAPTURE");
    expect(domainForPath("/admin/vendors")).toBe("CAPTURE");
    expect(domainForPath("/admin/prospects")).toBe("CAPTURE");
    expect(domainForPath("/admin/approvals")).toBe("CAPTURE");
    expect(domainForPath("/admin/inquiries")).toBe("CAPTURE");
  });

  it("defaults an unlisted /admin path to OPEN (the dashboard, the audit log, /admin/totp)", () => {
    expect(domainForPath("/admin")).toBe("OPEN");
    expect(domainForPath("/admin/audit")).toBe("OPEN");
    expect(domainForPath("/admin/totp")).toBe("OPEN");
    expect(domainForPath("/admin/totp/enroll")).toBe("OPEN");
  });

  it("does not false-positive on an unrelated path that merely starts with the same letters", () => {
    // /admin/vendorsomethingelse must NOT match the "/admin/vendors" prefix rule.
    expect(domainForPath("/admin/vendorsomethingelse")).toBe("OPEN");
  });
});
