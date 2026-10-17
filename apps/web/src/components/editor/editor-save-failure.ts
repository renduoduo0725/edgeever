import { getMemoSaveErrorReasonKey } from "@edgeever/shared";
import { ApiRequestError } from "@/lib/api";
import { LocalDatabaseUnavailableError } from "@/lib/local-database-recovery";
import { getMemoSaveConflictInfo, type MemoSaveConflictInfo } from "@/lib/memo-save-conflict";
import { shouldQueueMemoSaveError } from "@/lib/sync-queue";
import type { MemoUpdateSyncPayload } from "@/lib/local-db";
import { MemoSaveRequestError } from "./editor-pane-helpers";

export type EditorSaveFailure =
  | { kind: "storage" }
  | { kind: "conflict"; conflict: MemoSaveConflictInfo }
  | { kind: "queue"; payload: MemoUpdateSyncPayload; tagsText: string }
  | { kind: "error"; reasonKey: string | null };

export const classifyEditorSaveFailure = (error: unknown): EditorSaveFailure => {
  if (error instanceof LocalDatabaseUnavailableError) {
    return { kind: "storage" };
  }

  const sourceError = error instanceof MemoSaveRequestError ? error.originalError : error;
  const conflict = getMemoSaveConflictInfo(sourceError);
  if (conflict) {
    return { kind: "conflict", conflict };
  }

  if (error instanceof MemoSaveRequestError && shouldQueueMemoSaveError(sourceError)) {
    return { kind: "queue", payload: error.payload, tagsText: error.tagsText };
  }

  return {
    kind: "error",
    reasonKey: sourceError instanceof ApiRequestError ? getMemoSaveErrorReasonKey(sourceError.code, sourceError.message) : null,
  };
};

export const shouldLeaveEditorAfterSaveError = (error: unknown) =>
  classifyEditorSaveFailure(error).kind === "queue";
