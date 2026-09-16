import type { EditorSavePhase } from "./useEditorSaveStatus";

type Translate = (key: string) => string;

export const getEditorSaveChrome = ({
  saveState,
  hasUnsavedChanges,
  t,
}: {
  saveState: EditorSavePhase;
  hasUnsavedChanges: boolean;
  t: Translate;
}) => {
  const saveLabel =
    saveState === "saving"
      ? t("editor.saveState.saving")
      : saveState === "saved"
        ? t("editor.saveState.saved")
        : saveState === "queued"
          ? t("editor.saveState.queued")
          : saveState === "conflict"
            ? t("editor.saveState.conflict")
            : saveState === "error"
              ? t("editor.saveState.error")
              : hasUnsavedChanges
                ? t("editor.saveState.unsaved")
                : t("editor.saveState.saved");

  const saveStateClassName =
    saveState === "error" || saveState === "conflict"
      ? "bg-rose-50 text-rose-700"
      : saveState === "queued"
        ? "bg-slate-50 text-slate-400"
        : saveState === "saving" || hasUnsavedChanges
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500";

  return { saveLabel, saveStateClassName };
};
