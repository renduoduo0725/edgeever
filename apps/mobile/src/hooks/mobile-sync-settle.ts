type Flag = { current: boolean };

export type MobileSyncPassState = {
  running: Flag;
  requested: Flag;
  requestedForce: Flag;
};

/**
 * Finishes an automatic sync pass. Each step handles its own failure so a
 * failed queue read can never leave the runner marked as running, which would
 * silently stop automatic sync until the app restarts.
 */
export const settleMobileSyncPass = async (
  state: MobileSyncPassState,
  {
    refreshQueueItems,
    getRetryDelay,
    rerun,
    scheduleRetry,
  }: {
    refreshQueueItems: () => Promise<unknown>;
    getRetryDelay: () => Promise<number | null>;
    rerun: (force: boolean) => void;
    scheduleRetry: (delay: number) => void;
  },
) => {
  try {
    await refreshQueueItems();
  } catch {
    // The visible queue refreshes again after the next pass.
  }
  state.running.current = false;

  if (state.requested.current) {
    const nextForce = state.requestedForce.current;
    state.requested.current = false;
    state.requestedForce.current = false;
    rerun(nextForce);
    return;
  }

  let retryDelay: number | null = null;
  try {
    retryDelay = await getRetryDelay();
  } catch {
    // Without a readable queue there is nothing to schedule; foregrounding the app retries.
  }
  if (retryDelay !== null) {
    scheduleRetry(retryDelay);
  }
};
