export const isSuspiciousMemoOverwrite = (
  currentTitle: string | null,
  currentContentText: string,
  nextTitle: string | null,
  nextContentText: string
) => {
  const currentLength = currentContentText.trim().length;
  const nextLength = nextContentText.trim().length;
  const titleChanged = (currentTitle ?? "").trim() !== (nextTitle ?? "").trim();

  return titleChanged && currentLength >= 200 && nextLength < currentLength * 0.35;
};

export const isMemoEditBindingValid = (
  current: { memoId: string; revision: number; contentHash: string },
  session: { id: string; memoId: string; baseRevision: number; baseContentHash: string },
  request: { editSessionId: string; memoId: string; expectedRevision: number; expectedContentHash: string }
) =>
  request.memoId === current.memoId &&
  session.memoId === current.memoId &&
  request.editSessionId === session.id &&
  request.expectedRevision === current.revision &&
  session.baseRevision === current.revision &&
  request.expectedContentHash === current.contentHash &&
  session.baseContentHash === current.contentHash;

export const SUSPICIOUS_MEMO_OVERWRITE_ERROR = "suspicious_memo_overwrite";
export const SUSPICIOUS_MEMO_OVERWRITE_MESSAGE =
  "Save blocked because the title changed while most of the note content disappeared.";

/**
 * i18n key for a save rejection the server reports in English. The mobile sync
 * queue stores only the message, so the message is matched as well as the code.
 */
export const getMemoSaveErrorReasonKey = (code: string | null | undefined, message?: string | null) =>
  code === SUSPICIOUS_MEMO_OVERWRITE_ERROR || message?.trim() === SUSPICIOUS_MEMO_OVERWRITE_MESSAGE
    ? "editor.saveState.errorReason.suspiciousOverwrite"
    : null;
