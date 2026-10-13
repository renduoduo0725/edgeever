import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MEMO_LIST_WIDTH_PX,
  DEFAULT_NOTEBOOK_SIDEBAR_WIDTH_PX,
  clampMemoListWidth,
  clampNotebookSidebarWidth,
  readDesktopFocusModePreference,
  readImageCompressionPreference,
  readMemoListWidthPreference,
  readNotebookSidebarCollapsedPreference,
  readNotebookSidebarWidthPreference,
  readShortcutSettingsPreference,
  writeDesktopFocusModePreference,
  writeImageCompressionPreference,
  writeMemoListWidthPreference,
  writeNotebookSidebarCollapsedPreference,
  writeNotebookSidebarWidthPreference,
  writeShortcutSettingsPreference,
  type ShortcutSettings,
} from "@/lib/app-helpers";

export const useWorkspacePreferences = () => {
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(readImageCompressionPreference);
  const [desktopFocusMode, setDesktopFocusModeState] = useState(readDesktopFocusModePreference);
  const [notebookSidebarCollapsed, setNotebookSidebarCollapsedState] = useState(readNotebookSidebarCollapsedPreference);
  const [notebookSidebarWidth, setNotebookSidebarWidthState] = useState(readNotebookSidebarWidthPreference);
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

  const setMemoListWidth = useCallback((width: number) => {
    const nextWidth = clampMemoListWidth(width);
    setMemoListWidthState(nextWidth);
    writeMemoListWidthPreference(nextWidth);
  }, []);

  const setNotebookSidebarWidth = useCallback((width: number) => {
    const nextWidth = clampNotebookSidebarWidth(width);
    setNotebookSidebarWidthState(nextWidth);
    writeNotebookSidebarWidthPreference(nextWidth);
  }, []);

  const resetMemoListWidth = useCallback(() => {
    setMemoListWidth(DEFAULT_MEMO_LIST_WIDTH_PX);
  }, [setMemoListWidth]);

  const resetNotebookSidebarWidth = useCallback(() => {
    setNotebookSidebarWidth(DEFAULT_NOTEBOOK_SIDEBAR_WIDTH_PX);
  }, [setNotebookSidebarWidth]);

  return {
    desktopFocusMode,
    imageCompressionEnabled,
    memoListWidth,
    notebookSidebarCollapsed,
    notebookSidebarWidth,
    resetMemoListWidth,
    resetNotebookSidebarWidth,
    setDesktopFocusMode,
    setNotebookSidebarCollapsed,
    setImageCompressionEnabled,
    setMemoListWidth,
    setNotebookSidebarWidth,
    setShortcutSettings,
    shortcutSettings,
  };
};
