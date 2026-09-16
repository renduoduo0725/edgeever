import {
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { Editor } from "@tiptap/react";
import type { TiptapDoc } from "@edgeever/shared";
import {
  createMarkdownModeSnapshot,
  resolveMarkdownModeContent,
  type MarkdownModeSnapshot,
} from "./editor-mode-content";
import { getEditorScrollProgress, restoreEditorScrollProgress } from "./editor-mode-scroll";
import type { MarkdownSourceEditorRef } from "./MarkdownSourceEditor";
import { isEditorReady } from "./editor-pane-helpers";

export const useEditorMarkdownMode = ({
  editor,
  editorScrollContainerRef,
  effectiveReadOnly,
  getMemoId,
  hydratingRef,
}: {
  editor: Editor | null;
  editorScrollContainerRef: RefObject<HTMLDivElement | null>;
  effectiveReadOnly: boolean;
  getMemoId: () => string | null | undefined;
  hydratingRef: MutableRefObject<boolean>;
}) => {
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [markdownSource, setMarkdownSource] = useState("");
  const markdownSourceEditorRef = useRef<MarkdownSourceEditorRef | null>(null);
  const markdownModeSnapshotRef = useRef<MarkdownModeSnapshot | null>(null);

  const restoreScrollAfterModeChange = useCallback((targetMode: "markdown" | "rich", progress: number) => {
    const restore = (attempt: number) => {
      const target = targetMode === "markdown"
        ? markdownSourceEditorRef.current?.getScrollContainer() ?? null
        : editorScrollContainerRef.current;

      if (restoreEditorScrollProgress(target, progress) || attempt >= 2) {
        return;
      }

      window.requestAnimationFrame(() => restore(attempt + 1));
    };

    window.requestAnimationFrame(() => restore(0));
  }, [editorScrollContainerRef]);

  const applyMarkdownSourceToRichText = useCallback((scrollProgress: number) => {
    if (!isEditorReady(editor)) {
      return;
    }

    hydratingRef.current = true;
    editor.commands.setContent(resolveMarkdownModeContent(
      markdownModeSnapshotRef.current,
      getMemoId(),
      markdownSource,
    ));
    markdownModeSnapshotRef.current = null;
    setIsMarkdownMode(false);
    restoreScrollAfterModeChange("rich", scrollProgress);
    window.setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
  }, [editor, getMemoId, hydratingRef, markdownSource, restoreScrollAfterModeChange]);

  const handleMarkdownModeChange = useCallback(() => {
    if (effectiveReadOnly || !isEditorReady(editor)) {
      return;
    }

    const scrollProgress = getEditorScrollProgress(
      isMarkdownMode ? (markdownSourceEditorRef.current?.getScrollContainer() ?? null) : editorScrollContainerRef.current,
    );

    if (isMarkdownMode) {
      applyMarkdownSourceToRichText(scrollProgress);
      return;
    }

    const currentMemoId = getMemoId();
    if (!currentMemoId) {
      return;
    }
    const snapshot = createMarkdownModeSnapshot(
      currentMemoId,
      editor.getJSON() as TiptapDoc,
    );
    markdownModeSnapshotRef.current = snapshot;
    setMarkdownSource(snapshot.markdownSource);
    setIsMarkdownMode(true);
    restoreScrollAfterModeChange("markdown", scrollProgress);
  }, [
    applyMarkdownSourceToRichText,
    editor,
    editorScrollContainerRef,
    effectiveReadOnly,
    getMemoId,
    isMarkdownMode,
    restoreScrollAfterModeChange,
  ]);

  const resetMarkdownMode = useCallback(() => {
    markdownModeSnapshotRef.current = null;
    setMarkdownSource("");
    setIsMarkdownMode(false);
  }, []);

  const hydrateMarkdownSource = useCallback((memoId: string, content: TiptapDoc, markdown: string) => {
    setMarkdownSource(markdown);
    markdownModeSnapshotRef.current = isMarkdownMode
      ? createMarkdownModeSnapshot(memoId, content, markdown)
      : null;
  }, [isMarkdownMode]);

  const clearMarkdownSnapshot = useCallback(() => {
    markdownModeSnapshotRef.current = null;
  }, []);

  return {
    applyMarkdownSourceToRichText,
    clearMarkdownSnapshot,
    handleMarkdownModeChange,
    hydrateMarkdownSource,
    isMarkdownMode,
    markdownModeSnapshotRef,
    markdownSource,
    markdownSourceEditorRef,
    resetMarkdownMode,
    setIsMarkdownMode,
    setMarkdownSource,
  };
};
