import { describe, expect, test } from "bun:test";
import { settleMobileSyncPass } from "./mobile-sync-settle";

const createState = (requested = false, requestedForce = false) => ({
  running: { current: true },
  requested: { current: requested },
  requestedForce: { current: requestedForce },
});

const createEffects = (overrides: Partial<Parameters<typeof settleMobileSyncPass>[1]> = {}) => {
  const calls = { reruns: [] as boolean[], retries: [] as number[] };
  return {
    calls,
    effects: {
      refreshQueueItems: async () => [],
      getRetryDelay: async () => null,
      rerun: (force: boolean) => calls.reruns.push(force),
      scheduleRetry: (delay: number) => calls.retries.push(delay),
      ...overrides,
    },
  };
};

describe("settleMobileSyncPass", () => {
  test("marks the runner idle and schedules the next retry", async () => {
    const state = createState();
    const { calls, effects } = createEffects({ getRetryDelay: async () => 5000 });
    await settleMobileSyncPass(state, effects);
    expect(state.running.current).toBe(false);
    expect(calls.retries).toEqual([5000]);
    expect(calls.reruns).toEqual([]);
  });

  test("runs a pass requested meanwhile instead of scheduling a retry", async () => {
    const state = createState(true, true);
    const { calls, effects } = createEffects({ getRetryDelay: async () => 5000 });
    await settleMobileSyncPass(state, effects);
    expect(state.running.current).toBe(false);
    expect(state.requested.current).toBe(false);
    expect(state.requestedForce.current).toBe(false);
    expect(calls.reruns).toEqual([true]);
    expect(calls.retries).toEqual([]);
  });

  test("keeps automatic sync alive when refreshing the visible queue fails", async () => {
    const state = createState();
    const { calls, effects } = createEffects({
      refreshQueueItems: async () => {
        throw new Error("storage unavailable");
      },
      getRetryDelay: async () => 1000,
    });
    await settleMobileSyncPass(state, effects);
    expect(state.running.current).toBe(false);
    expect(calls.retries).toEqual([1000]);
  });

  test("does not reject when the retry delay cannot be read", async () => {
    const state = createState();
    const { calls, effects } = createEffects({
      getRetryDelay: async () => {
        throw new Error("storage unavailable");
      },
    });
    await expect(settleMobileSyncPass(state, effects)).resolves.toBeUndefined();
    expect(state.running.current).toBe(false);
    expect(calls.retries).toEqual([]);
  });
});
