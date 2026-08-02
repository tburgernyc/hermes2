import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

import { callStructured } from "./client.js";
import { reportAiUsage, usageEventFrom, withAiUsageSink } from "./usage.js";

const Schema = z.object({ score: z.number().int().min(1).max(100) });

function mockClient(usage: unknown): Anthropic {
  return {
    messages: {
      parse: vi.fn(async () => ({ parsed_output: { score: 50 }, content: [], usage })),
      create: vi.fn(async () => {
        throw new Error("should not reach fallback");
      }),
    },
  } as unknown as Anthropic;
}

describe("usageEventFrom", () => {
  it("normalizes a full Anthropic usage block", () => {
    const event = usageEventFrom("claude-sonnet-4-6", "triage", {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 5,
      cache_creation_input_tokens: 3,
    });
    expect(event).toEqual({
      model: "claude-sonnet-4-6",
      functionName: "triage",
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 5,
      cacheWriteTokens: 3,
    });
  });

  it("defaults every field to 0 when usage is missing/null (never throws, never fabricates)", () => {
    expect(usageEventFrom("m", "f", null)).toEqual({
      model: "m",
      functionName: "f",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(usageEventFrom("m", "f", undefined)).toEqual({
      model: "m",
      functionName: "f",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });
});

describe("withAiUsageSink / reportAiUsage", () => {
  it("is a safe no-op with no active sink", () => {
    expect(() =>
      reportAiUsage({
        model: "m",
        functionName: "f",
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).not.toThrow();
  });

  it("callStructured's successful call reports usage to the active sink", async () => {
    const client = mockClient({
      input_tokens: 42,
      output_tokens: 7,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    });
    const events: unknown[] = [];
    await withAiUsageSink(
      (e) => events.push(e),
      () =>
        callStructured(client, {
          schema: Schema,
          schemaName: "TriageVerdict",
          system: "s",
          user: "u",
          model: "claude-sonnet-4-6",
          maxRetries: 0,
        }),
    );
    expect(events).toEqual([
      {
        model: "claude-sonnet-4-6",
        functionName: "TriageVerdict",
        inputTokens: 42,
        outputTokens: 7,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ]);
  });

  it("does not leak a sink across concurrent async contexts (AsyncLocalStorage isolation)", async () => {
    const clientA = mockClient({ input_tokens: 1, output_tokens: 1 });
    const clientB = mockClient({ input_tokens: 2, output_tokens: 2 });
    const eventsA: unknown[] = [];
    const eventsB: unknown[] = [];

    await Promise.all([
      withAiUsageSink(
        (e) => eventsA.push(e),
        () =>
          callStructured(clientA, {
            schema: Schema,
            schemaName: "A",
            system: "s",
            user: "u",
            maxRetries: 0,
          }),
      ),
      withAiUsageSink(
        (e) => eventsB.push(e),
        () =>
          callStructured(clientB, {
            schema: Schema,
            schemaName: "B",
            system: "s",
            user: "u",
            maxRetries: 0,
          }),
      ),
    ]);

    expect(eventsA).toHaveLength(1);
    expect(eventsB).toHaveLength(1);
    expect((eventsA[0] as { functionName: string }).functionName).toBe("A");
    expect((eventsB[0] as { functionName: string }).functionName).toBe("B");
  });
});
