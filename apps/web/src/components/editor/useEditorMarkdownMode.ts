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
  analyzeMarkdownModeContent,
  createMarkdownModeSnapshot,
  selectMarkdownSourceForDocument,
  shouldKeepLiveMarkdownSource,
  type MarkdownModeSnapshot,
} from "./editor-mode-content";
import { getEditorScrollProgress, restoreEditorScrollProgress } from "./editor-mode-scroll";
import { markdownOffsetToRichPosition, richPositionToMarkdownOffset } from "./editor-mode-selection";
import type { MarkdownSourceEditorRef } from "./MarkdownSourceEditor";
import { isEditorReady } from "./editor-pane-helpers";

export const useEditorMarkdownMode = ({
  editor,
  editorScrollContainerRef,
  effectiveReadOnly,
  getMemoId,
  hydratingRef,
  onUnsafeRichTableEdit,
}: {
  editor: Editor | null;
  editorScrollContainerRef: RefObject<HTMLDivElement | null>;
  effectiveReadOnly: boolean;
  getMemoId: () => string | null | undefined;
  hydratingRef: MutableRefObject<boolean>;
  onUnsafeRichTableEdit: (unsafe: boolean) => void;
}) => {
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [markdownSource, setMarkdownSourceState] = useState("");
  const markdownSourceRef = useRef(markdownSource);
  markdownSourceRef.current = markdownSource;
  const markdownSourceEditorRef = useRef<MarkdownSourceEditorRef | null>(null);
  const markdownModeSnapshotRef = useRef<MarkdownModeSnapshot | null>(null);
  const pendingSourceSelectionRef = useRef<{ memoId: string; from: number; to: number } | null>(null);
  const getMemoIdRef = useRef(getMemoId);
  getMemoIdRef.current = getMemoId;

  const setMarkdownSource = useCallback((next: string | ((current: string) => string)): boolean => {
    const value = typeof next === "function" ? next(markdownSourceRef.current) : next;
    const snapshot = markdownModeSnapshotRef.current;
    const unsafe = Boolean(snapshot?.hasRichOnlyTableCells) && analyzeMarkdownModeContent(
      snapshot,
      getMemoIdRef.current(),
      value,
    ).hasUnsafeRichTableEdit;
    onUnsafeRichTableEdit(unsafe);
    if (unsafe) return false;
    markdownSourceRef.current = value;
    setMarkdownSourceState(value);
    return true;
  }, [onUnsafeRichTableEdit]);

  const getMarkdownSource = useCallback(() => markdownSourceRef.current, []);

  const handleMarkdownSourceReady = useCallback(() => {
    const sourceEditor = markdownSourceEditorRef.current;
    if (!sourceEditor) return;
    const pending = pendingSourceSelectionRef.current;
    pendingSourceSelectionRef.current = null;
    if (pending && pending.memoId === getMemoIdRef.current()) {
      sourceEditor.setSelection(pending.from, pending.to);
    }
    sourceEditor.focus();
  }, []);

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

    const currentMemoId = getMemoId();
    const resolved = analyzeMarkdownModeContent(
      markdownModeSnapshotRef.current,
      currentMemoId,
      markdownSourceRef.current,
    );
    if (resolved.hasUnsafeRichTableEdit) {
      onUnsafeRichTableEdit(true);
      return;
    }
    const content = resolved.contentJson;
    const sourceSelection = markdownSourceEditorRef.current?.getSelection();
    hydratingRef.current = true;
    editor.commands.setContent(content);
    const richFrom = sourceSelection
      ? markdownOffsetToRichPosition(editor.schema, editor.state.doc, markdownSourceRef.current, sourceSelection.from)
      : null;
    const richTo = sourceSelection?.to === sourceSelection?.from
      ? richFrom
      : sourceSelection
        ? markdownOffsetToRichPosition(editor.schema, editor.state.doc, markdownSourceRef.current, sourceSelection.to)
        : null;
    const hasMappedSelection = richFrom !== null && richTo !== null;
    if (hasMappedSelection) editor.commands.setTextSelection({ from: richFrom, to: richTo });
    markdownModeSnapshotRef.current = currentMemoId
      ? createMarkdownModeSnapshot(currentMemoId, content, markdownSourceRef.current)
      : null;
    setIsMarkdownMode(false);
    if (!hasMappedSelection) restoreScrollAfterModeChange("rich", scrollProgress);
    window.requestAnimationFrame(() => {
      if (getMemoId() === currentMemoId && !markdownSourceEditorRef.current) editor.view.focus();
    });
    window.setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
  }, [editor, getMemoId, hydratingRef, onUnsafeRichTableEdit, restoreScrollAfterModeChange]);

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
    const contentJson = editor.getJSON() as TiptapDoc;
    const serialized = createMarkdownModeSnapshot(currentMemoId, contentJson);
    const markdown = selectMarkdownSourceForDocument(
      markdownModeSnapshotRef.current,
      currentMemoId,
      contentJson,
      serialized.markdownSource,
    );
    const { from, to } = editor.state.selection;
    const sourceFrom = richPositionToMarkdownOffset(editor.state.doc, markdown, from);
    const sourceTo = to === from
      ? sourceFrom
      : richPositionToMarkdownOffset(editor.state.doc, markdown, to);
    pendingSourceSelectionRef.current = sourceFrom !== null && sourceTo !== null
      ? { memoId: currentMemoId, from: sourceFrom, to: sourceTo }
      : null;
    markdownModeSnapshotRef.current = createMarkdownModeSnapshot(
      currentMemoId,
      contentJson,
      markdown,
    );
    setMarkdownSourceState(markdown);
    markdownSourceRef.current = markdown;
    onUnsafeRichTableEdit(false);
    setIsMarkdownMode(true);
    if (!pendingSourceSelectionRef.current) restoreScrollAfterModeChange("markdown", scrollProgress);
  }, [
    applyMarkdownSourceToRichText,
    editor,
    editorScrollContainerRef,
    effectiveReadOnly,
    getMemoId,
    isMarkdownMode,
    onUnsafeRichTableEdit,
    restoreScrollAfterModeChange,
  ]);

  const resetMarkdownMode = useCallback(() => {
    markdownModeSnapshotRef.current = null;
    pendingSourceSelectionRef.current = null;
    setMarkdownSourceState("");
    markdownSourceRef.current = "";
    onUnsafeRichTableEdit(false);
    setIsMarkdownMode(false);
  }, [onUnsafeRichTableEdit]);

  const hydrateMarkdownSource = useCallback((
    memoId: string,
    content: TiptapDoc,
    markdown: string,
    options?: { force?: boolean },
  ) => {
    const keepLiveSource = !options?.force
      && isMarkdownMode
      && shouldKeepLiveMarkdownSource({
        snapshot: markdownModeSnapshotRef.current,
        memoId,
        liveMarkdownSource: markdownSourceRef.current,
        incomingMarkdown: markdown,
        incomingContent: content,
      });
    const nextSource = keepLiveSource ? markdownSourceRef.current : markdown;
    if (!keepLiveSource) {
      setMarkdownSourceState(markdown);
      markdownSourceRef.current = markdown;
    }
    onUnsafeRichTableEdit(false);
    markdownModeSnapshotRef.current = createMarkdownModeSnapshot(memoId, content, nextSource);
    return keepLiveSource;
  }, [isMarkdownMode, onUnsafeRichTableEdit]);

  const clearMarkdownSnapshot = useCallback(() => {
    markdownModeSnapshotRef.current = null;
  }, []);

  return {
    applyMarkdownSourceToRichText,
    clearMarkdownSnapshot,
    handleMarkdownModeChange,
    handleMarkdownSourceReady,
    getMarkdownSource,
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
