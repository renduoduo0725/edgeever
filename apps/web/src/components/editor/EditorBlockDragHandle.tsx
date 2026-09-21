import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

const BLOCK_DRAG_HANDLE_CLASS_NAME = "edgeever-block-drag-handle";

const isBlockDragHandleEvent = (event: DragEvent) => {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest(`.${BLOCK_DRAG_HANDLE_CLASS_NAME}`));
};

/** TipTap clears dataTransfer during dragstart; Chrome then refuses the drop unless a type remains. */
const retainBlockDragDataTransfer = (event: DragEvent) => {
  if (!isBlockDragHandleEvent(event) || !event.dataTransfer) {
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  if (![...event.dataTransfer.types].includes("text/plain")) {
    event.dataTransfer.setData("text/plain", " ");
  }
};

export const EditorBlockDragHandle = ({ editor }: { editor: Editor }) => {
  const { t } = useTranslation();

  useEffect(() => {
    document.addEventListener("dragstart", retainBlockDragDataTransfer);
    return () => document.removeEventListener("dragstart", retainBlockDragDataTransfer);
  }, []);

  if (editor.isDestroyed || !editor.isEditable) {
    return null;
  }

  return (
    <DragHandle
      editor={editor}
      className={BLOCK_DRAG_HANDLE_CLASS_NAME}
      nested
    >
      <span className="sr-only">{t("editor.dragHandle")}</span>
      <GripVertical aria-hidden="true" className="h-4 w-4" />
    </DragHandle>
  );
};
