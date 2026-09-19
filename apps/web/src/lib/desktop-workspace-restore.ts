import type { MemoView } from "@/lib/app-helpers";

export const DESKTOP_WORKSPACE_RESTORE_STORAGE_KEY = "edgeever.desktop.workspace-restore";

export type DesktopWorkspaceRestoreState = {
  selectedMemoId: string | null;
  selectedNotebookId: string | null;
  memoView: MemoView;
};

const isMemoView = (value: unknown): value is MemoView => value === "notebook" || value === "trash";

export const readDesktopWorkspaceRestoreState = (
  storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.sessionStorage,
): DesktopWorkspaceRestoreState | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DESKTOP_WORKSPACE_RESTORE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DesktopWorkspaceRestoreState>;
    return {
      selectedMemoId: typeof parsed.selectedMemoId === "string" ? parsed.selectedMemoId : null,
      selectedNotebookId: typeof parsed.selectedNotebookId === "string" ? parsed.selectedNotebookId : null,
      memoView: isMemoView(parsed.memoView) ? parsed.memoView : "notebook",
    };
  } catch {
    return null;
  }
};

export const writeDesktopWorkspaceRestoreState = (
  state: DesktopWorkspaceRestoreState,
  storage: Pick<Storage, "setItem"> | null = typeof window === "undefined" ? null : window.sessionStorage,
) => {
  if (!storage) return false;
  try {
    storage.setItem(DESKTOP_WORKSPACE_RESTORE_STORAGE_KEY, JSON.stringify({
      selectedMemoId: state.selectedMemoId,
      selectedNotebookId: state.selectedNotebookId,
      memoView: state.memoView,
    }));
    return true;
  } catch {
    return false;
  }
};

export const shouldRestoreDesktopWorkspace = () =>
  typeof window !== "undefined"
  && window.edgeeverDesktop?.isAvailable === true;
