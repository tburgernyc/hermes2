import { describe, expect, it } from "vitest";

import { assembleCapabilityStatement, renderCapabilityStatementText } from "./capability-statement.js";
import type { CapabilityStatementDraft } from "./schemas.js";

const DRAFT: CapabilityStatementDraft = {
  organizationOverview: "Small-business federal IT services provider.",
  relevantExperience: "Prior tiered IT support engagements.",
  technicalCapabilities: "Help desk, endpoint management, cloud migration.",
  differentiators: ["Founder-led", "Fast onboarding"],
};

describe("assembleCapabilityStatement (deterministic — no model input)", () => {
  it("always carries the review disclaimer + requiresAdminReview", () => {
    const doc = assembleCapabilityStatement(DRAFT);
    expect(doc.requiresAdminReview).toBe(true);
    expect(doc.disclaimer).toMatch(/reviewed.*by a human/i);
    expect(doc.draft).toBe(DRAFT);
  });
});

describe("renderCapabilityStatementText", () => {
  it("renders every section, the differentiators, and the disclaimer footer", () => {
    const doc = assembleCapabilityStatement(DRAFT);
    const text = renderCapabilityStatementText(doc, {
      orgName: "Burger Consulting LLC",
      solicitationTitle: "IT Support Sources Sought",
    });
    expect(text).toContain("CAPABILITY STATEMENT (DRAFT");
    expect(text).toContain("Burger Consulting LLC");
    expect(text).toContain("IT Support Sources Sought");
    expect(text).toContain("Organization Overview");
    expect(text).toContain(DRAFT.organizationOverview);
    expect(text).toContain("- Founder-led");
    expect(text).toContain(doc.disclaimer);
  });

  it("omits the Differentiators heading when there are none", () => {
    const doc = assembleCapabilityStatement({ ...DRAFT, differentiators: [] });
    const text = renderCapabilityStatementText(doc, { orgName: "Firm", solicitationTitle: "Notice" });
    expect(text).not.toContain("Differentiators");
  });
});
