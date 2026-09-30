import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MEMO_LIST_WIDTH_PX,
  clampMemoListWidth,
  readDesktopFocusModePreference,
  readImageCompressionPreference,
  readMemoListWidthPreference,
  readNotebookSidebarCollapsedPreference,
  readShortcutSettingsPreference,
  writeDesktopFocusModePreference,
  writeImageCompressionPreference,
  writeMemoListWidthPreference,
  writeNotebookSidebarCollapsedPreference,
  writeShortcutSettingsPreference,
  type ShortcutSettings,
} from "@/lib/app-helpers";
import {
  readEditorContentWidthPreference,
  writeEditorContentWidthPreference,
  type EditorContentWidth,
} from "@/lib/editor-content-width";

export const useWorkspacePreferences = () => {
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(readImageCompressionPreference);
  const [desktopFocusMode, setDesktopFocusModeState] = useState(readDesktopFocusModePreference);
  const [notebookSidebarCollapsed, setNotebookSidebarCollapsedState] = useState(readNotebookSidebarCollapsedPreference);
  const [editorContentWidth, setEditorContentWidthState] = useState(readEditorContentWidthPreference);
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

  const setEditorContentWidth = useCallback((width: EditorContentWidth) => {
    setEditorContentWidthState(width);
    writeEditorContentWidthPreference(width);
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
    editorContentWidth,
    imageCompressionEnabled,
    memoListWidth,
    notebookSidebarCollapsed,
    resetMemoListWidth,
    setDesktopFocusMode,
    setEditorContentWidth,
    setNotebookSidebarCollapsed,
    setImageCompressionEnabled,
    setMemoListWidth,
    setShortcutSettings,
    shortcutSettings,
  };
};
