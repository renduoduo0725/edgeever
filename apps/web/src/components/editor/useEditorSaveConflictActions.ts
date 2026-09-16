import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "@/lib/clipboard";
import { parseTagsText } from "@/lib/utils";
import {
  formatLocalDraftClipboardText,
  formatMemoSaveConflictReason,
  type MemoSaveConflictInfo,
} from "@/lib/memo-save-conflict";
import type { EditorSavePhase } from "./useEditorSaveStatus";

export type EditorConflictAction = "adopt" | "copy";

export const useEditorSaveConflictActions = ({
  saveState,
  saveConflictInfo,
  title,
  tagsText,
  getLocalDraftMarkdown,
  adoptCloudMemo,
}: {
  saveState: EditorSavePhase;
  saveConflictInfo: MemoSaveConflictInfo | null;
  title: string;
  tagsText: string;
  getLocalDraftMarkdown: () => string;
  adoptCloudMemo: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [conflictActionPending, setConflictActionPending] = useState<EditorConflictAction | null>(null);
  const [conflictActionMessage, setConflictActionMessage] = useState<string | null>(null);

  const saveConflictReason = useMemo(
    () => (saveState === "conflict" ? formatMemoSaveConflictReason(t, saveConflictInfo) : null),
    [saveConflictInfo, saveState, t],
  );

  useEffect(() => {
    if (saveState !== "conflict") {
      setConflictActionPending(null);
      setConflictActionMessage(null);
    }
  }, [saveState]);

  const handleCopyLocalDraft = useCallback(async () => {
    if (conflictActionPending) {
      return;
    }

    setConflictActionPending("copy");
    setConflictActionMessage(null);
    try {
      const text = formatLocalDraftClipboardText({
        title,
        tags: parseTagsText(tagsText),
        contentMarkdown: getLocalDraftMarkdown(),
      });
      const copied = await copyTextToClipboard(text);
      if (!copied) {
        setConflictActionMessage(t("editor.saveState.conflictCopyDraftFailed"));
        return;
      }
      setConflictActionMessage(t("editor.saveState.conflictCopyDraftDone"));
      window.setTimeout(() => {
        setConflictActionMessage((current) =>
          current === t("editor.saveState.conflictCopyDraftDone") ? null : current
        );
      }, 2000);
    } catch {
      setConflictActionMessage(t("editor.saveState.conflictCopyDraftFailed"));
    } finally {
      setConflictActionPending(null);
    }
  }, [conflictActionPending, getLocalDraftMarkdown, t, tagsText, title]);

  const handleAdoptCloudAndReload = useCallback(async () => {
    if (conflictActionPending === "adopt") {
      return;
    }

    setConflictActionPending("adopt");
    setConflictActionMessage(null);
    try {
      await adoptCloudMemo();
      setConflictActionMessage(null);
    } catch {
      setConflictActionMessage(t("editor.saveState.conflictAdoptFailed"));
    } finally {
      setConflictActionPending(null);
    }
  }, [adoptCloudMemo, conflictActionPending, t]);

  return {
    conflictActionMessage,
    conflictActionPending,
    handleAdoptCloudAndReload,
    handleCopyLocalDraft,
    saveConflictReason,
  };
};
