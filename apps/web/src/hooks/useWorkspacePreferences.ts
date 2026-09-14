import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MEMO_LIST_WIDTH_PX,
  clampMemoListWidth,
  readDesktopFocusModePreference,
  readEditorContentAlignmentPreference,
  readImageCompressionPreference,
  readMemoListWidthPreference,
  readNotebookSidebarCollapsedPreference,
  readShortcutSettingsPreference,
  writeDesktopFocusModePreference,
  writeEditorContentAlignmentPreference,
  writeImageCompressionPreference,
  writeMemoListWidthPreference,
  writeNotebookSidebarCollapsedPreference,
  writeShortcutSettingsPreference,
  type ShortcutSettings,
  type EditorContentAlignment,
} from "@/lib/app-helpers";

export const useWorkspacePreferences = () => {
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(readImageCompressionPreference);
  const [desktopFocusMode, setDesktopFocusModeState] = useState(readDesktopFocusModePreference);
  const [notebookSidebarCollapsed, setNotebookSidebarCollapsedState] = useState(readNotebookSidebarCollapsedPreference);
  const [editorContentAlignment, setEditorContentAlignmentState] = useState(readEditorContentAlignmentPreference);
  const [shortcutSettings, setShortcutSettings] = useState<ShortcutSettings>(readShortcutSettingsPreference);
  const [memoListWidth, setMemoListWidthState] = useState(readMemoListWidthPreference);

  useEffect(() => writeImageCompressionPreference(imageCompressionEnabled), [imageCompressionEnabled]);
  useEffect(() => writeShortcutSettingsPreference(shortcutSettings), [shortcutSettings]);

  const setDesktopFocusMode = useCallback((enabled: boolean) => {
    setDesktopFocusModeState(enabled);
    writeDesktopFocusModePreference(enabled);
  }, []);

  const setNotebookSidebarCollapsed = useCallback((collapsed: boolean) => {
    setNotebookSidebarCollapsedState(collapsed);
    writeNotebookSidebarCollapsedPreference(collapsed);
  }, []);

  const setEditorContentAlignment = useCallback((alignment: EditorContentAlignment) => {
    setEditorContentAlignmentState(alignment);
    writeEditorContentAlignmentPreference(alignment);
  }, []);

  const setMemoListWidth = useCallback((width: number) => {
    const nextWidth = clampMemoListWidth(width);
    setMemoListWidthState(nextWidth);
    writeMemoListWidthPreference(nextWidth);
  }, []);

  const resetMemoListWidth = useCallback(() => {
    setMemoListWidth(DEFAULT_MEMO_LIST_WIDTH_PX);
  }, [setMemoListWidth]);

  return {
    desktopFocusMode,
    editorContentAlignment,
    imageCompressionEnabled,
    memoListWidth,
    notebookSidebarCollapsed,
    resetMemoListWidth,
    setDesktopFocusMode,
    setEditorContentAlignment,
    setNotebookSidebarCollapsed,
    setImageCompressionEnabled,
    setMemoListWidth,
    setShortcutSettings,
    shortcutSettings,
  };
};
