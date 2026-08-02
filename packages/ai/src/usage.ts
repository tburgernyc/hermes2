/**
 * packages/ai/src/usage.ts — per-call Claude token/cost telemetry (§3.3 AI cost observability). This
 * package has ZERO database dependency by design (framework-free), so it cannot write an `ai_usage_events`
 * row itself. Instead every successful API call reports its usage through an AsyncLocalStorage-scoped sink
 * that the CALLER (packages/inngest, which has both the DB tx and the org context) installs around the
 * work it is about to do:
 *
 *   await withAiUsageSink((event) => recordAiUsageEvent(tx, orgId, event), () => triage(tx, deps, args));
 *
 * AsyncLocalStorage (not a module-level mutable variable) is deliberate: it is per-async-context, so
 * concurrent Inngest function invocations in the same Node process never cross-attribute usage to the
 * wrong org. `reportAiUsage` is a safe no-op when no sink is active (e.g. tests that call the engine
 * directly) — nothing breaks if a caller doesn't opt in.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface AiUsageEvent {
  model: string;
  /** The engine function that made the call (triage / scoreProspect / draftBid / …). */
  functionName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/**
 * The sink may be async (the production sink is a DB insert inside the caller's org-scoped tx) — the
 * caller MUST be able to await it, or the insert could still be in flight when the surrounding
 * transaction commits. `reportAiUsage` (below) always awaits whatever the sink returns.
 */
type UsageSink = (event: AiUsageEvent) => void | Promise<void>;

const storage = new AsyncLocalStorage<UsageSink>();

/**
 * Run `fn` with `onUsage` active as the usage sink for its entire async call tree — every
 * callStructured / raw messages.create call made directly or transitively during `fn` reports here.
 */
export function withAiUsageSink<T>(onUsage: UsageSink, fn: () => Promise<T>): Promise<T> {
  return storage.run(onUsage, fn);
}

/** Report one call's usage to the active sink, if any (and await it). Safe no-op outside withAiUsageSink. */
export async function reportAiUsage(event: AiUsageEvent): Promise<void> {
  const sink = storage.getStore();
  await sink?.(event);
}

/** Normalize an Anthropic SDK `usage` block (fields vary/optional by response type) into AiUsageEvent. */
export function usageEventFrom(
  model: string,
  functionName: string,
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  } | null | undefined,
): AiUsageEvent {
  return {
    model,
    functionName,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
  };
}
