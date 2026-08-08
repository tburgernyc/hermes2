import { describe, expect, test } from "vitest";

import {
  groupByColumn,
  humanizeStatus,
  isActivatableContractStatus,
  isBounceableOutreachStatus,
  isCloseoutableContractStatus,
  isComplianceReviewableProposalStatus,
  isCompletableContractStatus,
  isCompletableMilestoneStatus,
  isCounselReviewableProposalStatus,
  isDeclinableProspectStatus,
  isEsignResolvableStatus,
  isEsignStartableStatus,
  isOutcomeRecordableStatus,
  isPricingReviewableProposalStatus,
  isQualifiableProspectStatus,
  isRespondableProspectStatus,
  isStartableMilestoneStatus,
  isTerminatableContractStatus,
  SOLICITATION_BOARD,
} from "./admin-board";

describe("groupByColumn", () => {
  test("buckets rows into the right board columns", () => {
    const rows = [
      { id: "a", status: "PENDING_TRIAGE" },
      { id: "b", status: "TRIAGE_COMPLETE" },
      { id: "c", status: "PRICING_PENDING" },
      { id: "d", status: "NO_GO" },
    ];

    const groups = groupByColumn(rows);
    const byTitle = Object.fromEntries(groups.map((g) => [g.title, g.items.map((i) => i.id)]));

    expect(byTitle["Triage"]).toEqual(["a", "b"]);
    expect(byTitle["Pricing & bid"]).toEqual(["c"]);
    expect(byTitle["Closed"]).toEqual(["d"]);
  });

  test("returns every column even when empty, in board order", () => {
    const groups = groupByColumn([]);
    expect(groups.map((g) => g.title)).toEqual(SOLICITATION_BOARD.map((c) => c.title));
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });

  test("preserves original row order within a column", () => {
    const rows = [
      { id: "first", status: "READY_FOR_SOURCING" },
      { id: "second", status: "AWAITING_APPROVAL" },
      { id: "third", status: "SOURCING_IN_PROGRESS" },
    ];
    const sourcing = groupByColumn(rows).find((g) => g.title === "Sourcing");
    expect(sourcing?.items.map((i) => i.id)).toEqual(["first", "second", "third"]);
  });

  test("drops rows whose status is in no column (does not throw)", () => {
    const groups = groupByColumn([{ id: "x", status: "NOT_A_REAL_STATUS" }]);
    expect(groups.flatMap((g) => g.items)).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const rows = [{ id: "a", status: "PENDING_TRIAGE" }];
    const snapshot = [...rows];
    groupByColumn(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe("humanizeStatus", () => {
  test("converts UPPER_SNAKE_CASE to a readable label", () => {
    expect(humanizeStatus("PRICING_PENDING")).toBe("Pricing pending");
    expect(humanizeStatus("NO_GO")).toBe("No go");
    expect(humanizeStatus("SUBMITTED")).toBe("Submitted");
  });

  test("handles the empty string without throwing", () => {
    expect(humanizeStatus("")).toBe("");
  });
});

describe("isQualifiableProspectStatus", () => {
  test("is true for the active, non-terminal statuses", () => {
    for (const s of ["NEW", "SCREENED", "CONTACTED", "RESPONDED"]) {
      expect(isQualifiableProspectStatus(s)).toBe(true);
    }
  });

  test("is false for terminal / already-advanced statuses", () => {
    for (const s of ["QUALIFIED", "PROMOTED", "DECLINED", "OPTED_OUT", "anything-else"]) {
      expect(isQualifiableProspectStatus(s)).toBe(false);
    }
  });
});

describe("isRespondableProspectStatus", () => {
  test("is true only for CONTACTED (a reply only makes sense once outreach went out)", () => {
    expect(isRespondableProspectStatus("CONTACTED")).toBe(true);
  });

  test("is false before contact and for already-advanced/terminal statuses", () => {
    for (const s of [
      "NEW",
      "SCREENED",
      "RESPONDED",
      "QUALIFIED",
      "PROMOTED",
      "DECLINED",
      "OPTED_OUT",
      "anything-else",
    ]) {
      expect(isRespondableProspectStatus(s)).toBe(false);
    }
  });
});

describe("isDeclinableProspectStatus", () => {
  test("is true for every active, non-terminal status including QUALIFIED", () => {
    for (const s of ["NEW", "SCREENED", "CONTACTED", "RESPONDED", "QUALIFIED"]) {
      expect(isDeclinableProspectStatus(s)).toBe(true);
    }
  });

  test("is false for already-terminal statuses", () => {
    for (const s of ["PROMOTED", "DECLINED", "OPTED_OUT", "anything-else"]) {
      expect(isDeclinableProspectStatus(s)).toBe(false);
    }
  });
});

describe("isOutcomeRecordableStatus", () => {
  test("is true only for SUBMITTED (the honest precondition — the bid actually left the building)", () => {
    expect(isOutcomeRecordableStatus("SUBMITTED")).toBe(true);
  });

  test("is false before submission and for already-terminal outcome states", () => {
    for (const s of [
      "PENDING_TRIAGE",
      "TRIAGE_COMPLETE",
      "PROPOSAL_DRAFT",
      "PRICING_PENDING",
      "AWARDED",
      "REJECTED",
      "CLOSED",
      "anything-else",
    ]) {
      expect(isOutcomeRecordableStatus(s)).toBe(false);
    }
  });
});

// §3.2 baseline audit: the post-award contract/esign/milestone/proposal/outreach lifecycle had zero
// writers past the first reachable state — these predicates are the single source of truth shared with
// the actions that guard the writes (subcontract/actions.ts, proposal/actions.ts, prospects/actions.ts).

describe("isActivatableContractStatus", () => {
  test("is true only for PENDING_SIGNATURE (esign_status=SIGNED is checked separately at the call site)", () => {
    expect(isActivatableContractStatus("PENDING_SIGNATURE")).toBe(true);
  });

  test("is false once the contract has already moved on, or is terminal", () => {
    for (const s of ["ACTIVE", "COMPLETED", "TERMINATED", "CLOSED_OUT", "anything-else"]) {
      expect(isActivatableContractStatus(s)).toBe(false);
    }
  });
});

describe("isTerminatableContractStatus", () => {
  test("is true from either pre-signature or active", () => {
    expect(isTerminatableContractStatus("PENDING_SIGNATURE")).toBe(true);
    expect(isTerminatableContractStatus("ACTIVE")).toBe(true);
  });

  test("is false once already terminal", () => {
    for (const s of ["COMPLETED", "TERMINATED", "CLOSED_OUT", "anything-else"]) {
      expect(isTerminatableContractStatus(s)).toBe(false);
    }
  });
});

describe("isCompletableContractStatus", () => {
  test("is true only for ACTIVE", () => {
    expect(isCompletableContractStatus("ACTIVE")).toBe(true);
  });

  test("is false everywhere else", () => {
    for (const s of ["PENDING_SIGNATURE", "COMPLETED", "TERMINATED", "CLOSED_OUT", "anything-else"]) {
      expect(isCompletableContractStatus(s)).toBe(false);
    }
  });
});

describe("isCloseoutableContractStatus", () => {
  test("is true only for COMPLETED", () => {
    expect(isCloseoutableContractStatus("COMPLETED")).toBe(true);
  });

  test("is false everywhere else, including the other terminal states", () => {
    for (const s of ["PENDING_SIGNATURE", "ACTIVE", "TERMINATED", "CLOSED_OUT", "anything-else"]) {
      expect(isCloseoutableContractStatus(s)).toBe(false);
    }
  });
});

describe("isEsignResolvableStatus", () => {
  test("is true only for SENT (the admin records SIGNED/EXPIRED/DECLINED as an external fact)", () => {
    expect(isEsignResolvableStatus("SENT")).toBe(true);
  });

  test("is false for every other esign_status", () => {
    for (const s of ["NOT_STARTED", "SIGNED", "DECLINED", "EXPIRED", "anything-else"]) {
      expect(isEsignResolvableStatus(s)).toBe(false);
    }
  });
});

describe("isEsignStartableStatus", () => {
  test("is true for NOT_STARTED (first send) and EXPIRED/DECLINED (an explicit resend)", () => {
    for (const s of ["NOT_STARTED", "EXPIRED", "DECLINED"]) {
      expect(isEsignStartableStatus(s)).toBe(true);
    }
  });

  test("is false once already SENT or SIGNED", () => {
    for (const s of ["SENT", "SIGNED", "anything-else"]) {
      expect(isEsignStartableStatus(s)).toBe(false);
    }
  });
});

describe("isStartableMilestoneStatus / isCompletableMilestoneStatus", () => {
  test("PENDING can be started; IN_PROGRESS can be completed", () => {
    expect(isStartableMilestoneStatus("PENDING")).toBe(true);
    expect(isCompletableMilestoneStatus("IN_PROGRESS")).toBe(true);
  });

  test("INVOICED/PAID are never reachable from this admin surface (the §3.3 finance flow owns them)", () => {
    for (const s of ["INVOICED", "PAID", "COMPLETED", "anything-else"]) {
      expect(isStartableMilestoneStatus(s)).toBe(false);
      expect(isCompletableMilestoneStatus(s)).toBe(false);
    }
  });
});

describe("proposal pricing/compliance/counsel review ladder", () => {
  test("each predicate is true only for its single source status", () => {
    expect(isPricingReviewableProposalStatus("DRAFT")).toBe(true);
    expect(isComplianceReviewableProposalStatus("PRICING_REVIEW")).toBe(true);
    expect(isCounselReviewableProposalStatus("COMPLIANCE_REVIEW")).toBe(true);
  });

  test("no predicate accepts a status outside its own step", () => {
    const statuses = [
      "DRAFT",
      "PRICING_REVIEW",
      "COMPLIANCE_REVIEW",
      "COUNSEL_REVIEW",
      "READY_TO_SUBMIT",
      "SUBMITTED",
    ];
    for (const s of statuses.filter((x) => x !== "DRAFT")) {
      expect(isPricingReviewableProposalStatus(s)).toBe(false);
    }
    for (const s of statuses.filter((x) => x !== "PRICING_REVIEW")) {
      expect(isComplianceReviewableProposalStatus(s)).toBe(false);
    }
    for (const s of statuses.filter((x) => x !== "COMPLIANCE_REVIEW")) {
      expect(isCounselReviewableProposalStatus(s)).toBe(false);
    }
  });
});

describe("isBounceableOutreachStatus", () => {
  test("is true only for SENT (the operator records a bounce they saw in their own inbox)", () => {
    expect(isBounceableOutreachStatus("SENT")).toBe(true);
  });

  test("is false for every other outreach_status", () => {
    for (const s of [
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "BOUNCED",
      "RESPONDED",
      "OPTED_OUT",
      "CANCELLED",
      "anything-else",
    ]) {
      expect(isBounceableOutreachStatus(s)).toBe(false);
    }
  });
});
