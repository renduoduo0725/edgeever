import { useCallback, useEffect, useRef } from "react";
import type { MemoDetail } from "@edgeever/shared";
import type { EdgeEverRepository } from "@/lib/repository";

// Resolve the notebook through the repository, not through the current (possibly
// filtered or paginated) list. Keep the current editor until the target is ready.
export const useMemoLinkNavigation = ({
  repository,
  navigationScope,
  onOpen,
  onError,
}: {
  repository: Pick<EdgeEverRepository, "getMemo">;
  navigationScope: string;
  onOpen: (memo: MemoDetail) => void;
  onError: () => void;
}) => {
  const requestIdRef = useRef(0);
  const latestRef = useRef({ repository, navigationScope, onOpen, onError });
  latestRef.current = { repository, navigationScope, onOpen, onError };

  // A notebook/list selection, account change, or unmount cancels an unresolved
  // link so a late response cannot navigate away from the user's newer choice.
  useEffect(() => () => { requestIdRef.current += 1; }, [repository, navigationScope]);

  return useCallback(async (memoId: string) => {
    const requestId = ++requestIdRef.current;
    const origin = latestRef.current;
    const isCurrent = () => requestId === requestIdRef.current
      && origin.repository === latestRef.current.repository
      && origin.navigationScope === latestRef.current.navigationScope;

    try {
      const { memo } = await origin.repository.getMemo(memoId);
      if (!isCurrent()) return;
      if (memo.isDeleted) {
        latestRef.current.onError();
        return;
      }
      latestRef.current.onOpen(memo);
    } catch {
      if (isCurrent()) latestRef.current.onError();
    }
  }, []);
};
