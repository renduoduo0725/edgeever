export type EditorCloseGate = {
  closeInFlight: boolean;
  saving: boolean;
  uploading: boolean;
};

export type EditorCloseAction = "block" | "defer" | "run";

/** Decide whether a back/done tap can close now, wait for an in-flight save, or must stay. */
export const resolveEditorCloseAction = ({
  closeInFlight,
  saving,
  uploading,
}: EditorCloseGate): EditorCloseAction => {
  if (uploading) return "block";
  if (saving || closeInFlight) return "defer";
  return "run";
};
