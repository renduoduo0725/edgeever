import { useCallback, useEffect, type RefObject } from "react";

export const useMemoSelectionReconciliation = ({
  memos,
  selectedMemoId,
  setSelectedMemoId,
  rendererRecoveryMode,
  creatingMemoSelectionRef,
  pendingCreatedMemoIdRef,
  pendingOpenedMemoIdRef,
  createdMemoEditId,
}: {
  memos: ReadonlyArray<{ id: string }>;
  selectedMemoId: string | null;
  setSelectedMemoId: (id: string | null) => void;
  rendererRecoveryMode: boolean;
  creatingMemoSelectionRef: RefObject<boolean>;
  pendingCreatedMemoIdRef: RefObject<string | null>;
  pendingOpenedMemoIdRef: RefObject<string | null>;
  createdMemoEditId: string | null;
}) => {
  // Call only for explicit list/notebook actions, never for a programmatic
  // note open: its guard must survive the destination list's first page.
  const clearPendingMemoSelection = useCallback(() => {
    if (!pendingOpenedMemoIdRef.current) return;
    pendingOpenedMemoIdRef.current = null;
    // Reconcile even when the user reselects the same notebook/list identity.
    setSelectedMemoId(null);
  }, [pendingOpenedMemoIdRef, setSelectedMemoId]);

  useEffect(() => {
    const selectedMemoInList = selectedMemoId ? memos.some((memo) => memo.id === selectedMemoId) : false;
    if (rendererRecoveryMode) return;
    if (creatingMemoSelectionRef.current || pendingCreatedMemoIdRef.current) return;

    if (pendingOpenedMemoIdRef.current) {
      if (!memos.some((memo) => memo.id === pendingOpenedMemoIdRef.current)) return;
      pendingOpenedMemoIdRef.current = null;
    }

    if (createdMemoEditId && selectedMemoId === createdMemoEditId) {
      // Preserve the new note until the editor has consumed its autofocus request.
      return;
    }
    if (memos.length === 0) {
      setSelectedMemoId(null);
      return;
    }
    if (!selectedMemoId || !selectedMemoInList) setSelectedMemoId(memos[0].id);
  }, [createdMemoEditId, creatingMemoSelectionRef, memos, pendingCreatedMemoIdRef, pendingOpenedMemoIdRef, rendererRecoveryMode, selectedMemoId, setSelectedMemoId]);

  return clearPendingMemoSelection;
};
