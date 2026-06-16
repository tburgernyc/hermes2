import { describe, expect, test } from "vitest";

import {
  groupByColumn,
  humanizeStatus,
  isQualifiableProspectStatus,
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
