import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { createEdgeEverClient } from "@edgeever/client";
import type { MemoDetail } from "@edgeever/shared";
import {
  getMobileSyncRetryDelay,
  listMobileSyncQueueItems,
  loadMobileSyncQueueSummary,
  syncMobileQueuedChanges,
  type MobileSyncQueueItem,
} from "../lib/sync-queue";
import { replaceLocalMemoId, upsertLocalMemo } from "../lib/local-mirror";
import { settleMobileSyncPass } from "./mobile-sync-settle";

type MobileClient = ReturnType<typeof createEdgeEverClient>;

export const useMobileAutomaticSync = ({
  client,
  dataScope,
  onMemoIdRemapped,
  syncQueueScope,
}: {
  client: MobileClient | null;
  dataScope: string;
  onMemoIdRemapped: (temporaryId: string, memo: MemoDetail) => void;
  syncQueueScope: string;
}) => {
  const queryClient = useQueryClient();
  const [syncQueueItems, setSyncQueueItems] = useState<MobileSyncQueueItem[]>([]);
  const runningRef = useRef(false);
  const requestedRef = useRef(false);
  const requestedForceRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);

  const refreshSyncQueueItems = useCallback(async () => {
    const items = await listMobileSyncQueueItems(syncQueueScope);
    setSyncQueueItems(items);
    return items;
  }, [syncQueueScope]);

  const invalidateSyncedWorkspace = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mobile", "notebooks"] }),
      queryClient.invalidateQueries({ queryKey: ["mobile", "memos"] }),
      queryClient.invalidateQueries({ queryKey: ["mobile", "search"] }),
      queryClient.invalidateQueries({ queryKey: ["mobile", "memo"] }),
    ]);
  }, [queryClient]);

  const runAutomaticSync = useCallback(async (force = false) => {
    if (!client) {
      return;
    }

    if (runningRef.current) {
      requestedRef.current = true;
      requestedForceRef.current = requestedForceRef.current || force;
      return;
    }

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    runningRef.current = true;
    let shouldForce = force;

    try {
      for (;;) {
        const summary = await loadMobileSyncQueueSummary(syncQueueScope);
        const retryable = summary.pending + summary.error + summary.syncing;

        if (retryable > 0) {
          await syncMobileQueuedChanges(client, syncQueueScope, {
            force: shouldForce,
            onSynced: async (memo, item) => {
              if (item.kind === "memo.create") {
                await replaceLocalMemoId(dataScope, item.memoId, memo);
                onMemoIdRemapped(item.memoId, memo);
              } else {
                await upsertLocalMemo(dataScope, memo);
              }
              queryClient.setQueryData(["mobile", "memo", "notebook", memo.id], { memo });
              queryClient.setQueryData(["mobile", "memo", "trash", memo.id], { memo });
            },
          });

          const nextSummary = await loadMobileSyncQueueSummary(syncQueueScope);
          if (nextSummary.total === 0) {
            await invalidateSyncedWorkspace();
          }
        }

        if (!requestedRef.current) {
          break;
        }

        shouldForce = requestedForceRef.current;
        requestedRef.current = false;
        requestedForceRef.current = false;
      }
    } catch {
      // Queue metadata remains durable; the scheduled pass resumes it.
    }

    await settleMobileSyncPass(
      { running: runningRef, requested: requestedRef, requestedForce: requestedForceRef },
      {
        refreshQueueItems: refreshSyncQueueItems,
        getRetryDelay: () => getMobileSyncRetryDelay(syncQueueScope),
        rerun: (nextForce) => {
          void runRef.current(nextForce);
        },
        scheduleRetry: (retryDelay) => {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            void runRef.current(false);
          }, retryDelay);
        },
      },
    );
  }, [client, dataScope, invalidateSyncedWorkspace, onMemoIdRemapped, queryClient, refreshSyncQueueItems, syncQueueScope]);

  const runForcedSync = useCallback(async () => {
    await runAutomaticSync(true);
  }, [runAutomaticSync]);

  runRef.current = runAutomaticSync;

  useEffect(() => {
    if (!client) {
      return;
    }

    void runRef.current(false);

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        // Returning to the app should immediately retry any deferred failures.
        void runRef.current(true);
      }
    });

    return () => {
      subscription.remove();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [client, syncQueueScope]);

  return {
    refreshSyncQueueItems,
    runAutomaticSync,
    runForcedSync,
    syncQueueItems,
  };
};
