export type PendingEditorInsertFiles = {
  memoId: string;
  files: File[];
};

export const pendingEditorInsertMatchesMemo = (
  pendingInsertFiles: PendingEditorInsertFiles | null | undefined,
  memoId: string | null | undefined,
  memoAliases?: ReadonlySet<string>,
) => Boolean(
  pendingInsertFiles
  && memoId
  && (
    pendingInsertFiles.memoId === memoId
    || Boolean(memoAliases?.has(pendingInsertFiles.memoId))
  ),
);

export const usablePendingInsertFiles = (
  pendingInsertFiles: PendingEditorInsertFiles | null | undefined,
) => (pendingInsertFiles?.files ?? []).filter((file) => file.size > 0);

export const shouldInsertPendingEditorFiles = ({
  pendingInsertFiles,
  memoId,
  memoAliases,
  editorHydratedForMemo,
  editorReady,
  readOnly,
}: {
  pendingInsertFiles?: PendingEditorInsertFiles | null;
  memoId?: string | null;
  memoAliases?: ReadonlySet<string>;
  editorHydratedForMemo: boolean;
  editorReady: boolean;
  readOnly: boolean;
}) => Boolean(
  pendingEditorInsertMatchesMemo(pendingInsertFiles, memoId, memoAliases)
  && editorHydratedForMemo
  && editorReady
  && !readOnly
  && usablePendingInsertFiles(pendingInsertFiles).length > 0
);
