import { describe, expect, test } from "bun:test";
import {
  DESKTOP_WORKSPACE_RESTORE_STORAGE_KEY,
  readDesktopWorkspaceRestoreState,
  shouldRestoreDesktopWorkspace,
  writeDesktopWorkspaceRestoreState,
} from "./desktop-workspace-restore.ts";

const createStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
};

describe("desktop workspace restore", () => {
  test("round-trips the last notebook and memo", () => {
    const storage = createStorage();

    expect(writeDesktopWorkspaceRestoreState({
      selectedMemoId: "memo_1",
      selectedNotebookId: "nb_1",
      memoView: "notebook",
    }, storage)).toBe(true);
    expect(readDesktopWorkspaceRestoreState(storage)).toEqual({
      selectedMemoId: "memo_1",
      selectedNotebookId: "nb_1",
      memoView: "notebook",
    });
    expect(storage.data[DESKTOP_WORKSPACE_RESTORE_STORAGE_KEY]).toContain("memo_1");
  });

  test("ignores malformed session snapshots", () => {
    expect(readDesktopWorkspaceRestoreState(createStorage({
      [DESKTOP_WORKSPACE_RESTORE_STORAGE_KEY]: "{",
    }))).toBeNull();
  });

  test("is only used in the desktop renderer", () => {
    const previous = globalThis.window;
    globalThis.window = { edgeeverDesktop: { isAvailable: true } };
    try {
      expect(shouldRestoreDesktopWorkspace()).toBe(true);
    } finally {
      globalThis.window = previous;
    }
  });
});
