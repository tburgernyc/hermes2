/**
 * §3.3: the morning brief now folds in the SAM/reps-certs compliance reminders and the subcontractor
 * Prompt-Payment at-risk/missed flags (the same internal-digest pattern as deadlines/AR — CLAUDE.md §2:
 * informational only, never a third-party send).
 */
import { render } from "@react-email/render";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { MorningBrief } from "./MorningBrief.js";
import type { MorningBriefInput } from "../types.js";

const BASE: MorningBriefInput = {
  to: "admin@example.test",
  orgName: "Burger Consulting",
  dateLabel: "2026-08-01",
  triageReady: [],
  awaitingApproval: [],
  rankedQuotes: 0,
  deadlines: [],
  arOverdue: [],
  complianceReminders: [],
  paymentsAtRisk: [],
  approvalsUrl: "https://burgergov.com/admin/approvals",
};

describe("MorningBrief §3.3 sections", () => {
  it("renders compliance reminders and payments-at-risk items when present", async () => {
    const html = await render(
      createElement(MorningBrief, {
        ...BASE,
        complianceReminders: [{ label: "SAM.gov registration", detail: "expires in 30 day(s)" }],
        paymentsAtRisk: [{ label: "Payable abcd1234", detail: "$5,000.00 — missed, due 2026-07-20" }],
      }),
    );

    expect(html).toContain("Compliance reminders");
    expect(html).toContain("SAM.gov registration");
    expect(html).toContain("expires in 30 day(s)");
    expect(html).toContain("Subcontractor payments at risk or missed");
    expect(html).toContain("Payable abcd1234");
  });

  it("renders 'None.' for both sections when nothing is flagged (never fabricated)", async () => {
    const html = await render(createElement(MorningBrief, BASE));
    // Both new ItemList sections render their own "(0)" count with "None." beneath.
    const noneCount = (html.match(/None\./g) ?? []).length;
    expect(noneCount).toBeGreaterThanOrEqual(2); // at minimum: compliance reminders + payments at risk
  });
});
