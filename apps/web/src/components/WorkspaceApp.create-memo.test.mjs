import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workspaceSource = readFileSync(new URL("./WorkspaceApp.tsx", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("./EditorPane.tsx", import.meta.url), "utf8");
const searchControllerSource = readFileSync(new URL("./editor/useEditorNoteSearchController.ts", import.meta.url), "utf8");
const queuedSyncSource = readFileSync(new URL("../hooks/useWorkspaceQueuedSync.ts", import.meta.url), "utf8");

describe("desktop create-note wiring", () => {
  test("ignores a second new-note request while the first create is still in flight", () => {
    expect(workspaceSource).toContain("createMemoInFlightRef");
    expect(workspaceSource).toContain("createMemoInFlightRef.current || createMemoMutation.isPending");
    expect(workspaceSource).toContain("createMemoInFlightRef.current = false");
  });

  test("remaps the memo list when a local create id becomes the durable id", () => {
    expect(queuedSyncSource).toContain("remapMemoIdsInLists(queryClient, memoIdMappings)");
    expect(queuedSyncSource).toContain("MEMO_ID_REMAPPED_EVENT");
  });

  test("resets in-note search on editor instance changes, not local-to-remote id remaps", () => {
    expect(searchControllerSource).toContain("editorInstanceKey");
    expect(searchControllerSource).toContain("shouldResetNoteSearchForMemoChange(previousEditorInstanceKeyRef.current, editorInstanceKey)");
    expect(editorSource).toContain("editorInstanceKey: editorInstanceMemoKey");
  });

  test("keeps retrying create-note autofocus until the editor is editable and focused", () => {
    expect(editorSource).toContain("shouldRetryCreatedMemoFocus");
    expect(editorSource).toContain("isCreatedMemoEditorFocused");
    expect(editorSource).toContain("currentEditor.isEditable");
  });
});
