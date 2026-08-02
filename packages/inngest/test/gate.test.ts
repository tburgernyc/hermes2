/**
 * Gate-wiring (structural, no DB). The durable approval gate is enforced in three layers — this asserts
 * the registry layer: outreachGateFn (the only function that calls sendOutreach) is registered, and it is
 * a distinct function from every autonomous cron/event handler. The behavioral guarantee that a send
 * cannot happen without an APPROVED campaign is proven in logic.test.ts; the DB CHECK backstop lives in
 * the @hermes/db suite. Importing this module touches no DB and no API key (all clients are lazy).
 */
import { describe, expect, it } from "vitest";

import {
  arFn,
  deadlineFn,
  draftProposalBidFn,
  draftRfiCapabilityStatementFn,
  draftSubcontractFn,
  functions,
  heartbeatFn,
  morningBriefFn,
  onSourcingApprovedFn,
  outreachGateFn,
  quoteDetectorFn,
  samScan,
  triageFn,
  usaspendingFn,
} from "../src/functions.js";

describe("durable function registry", () => {
  it("registers all thirteen functions, including the approval gate", () => {
    expect(functions).toContain(outreachGateFn);
    expect(functions).toHaveLength(13);
    // No accidental duplicates — every served function is a distinct object.
    expect(new Set(functions).size).toBe(functions.length);
  });

  it("keeps the gate distinct from every autonomous / event-triggered function", () => {
    // draftProposalBidFn / draftSubcontractFn / draftRfiCapabilityStatementFn are event-triggered (they
    // react to a human-gate event, like triageFn reacts to ingest) — none is the outreach waitForEvent
    // gate, and none sends or submits.
    const nonGate = [
      samScan,
      triageFn,
      onSourcingApprovedFn,
      draftProposalBidFn,
      draftSubcontractFn,
      draftRfiCapabilityStatementFn,
      quoteDetectorFn,
      usaspendingFn,
      deadlineFn,
      arFn,
      morningBriefFn,
      heartbeatFn,
    ];
    expect(nonGate).not.toContain(outreachGateFn);
    for (const fn of nonGate) expect(functions).toContain(fn);
  });
});
