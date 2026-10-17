import type { FontLoadStatus } from "@/lib/font-load-state";
import { useCallback } from "react";
import { prepareNoteImageAssets } from "@edgeever/shared/note-image-fonts";
import { noteImageAssetUrls } from "@edgeever/shared/note-image-assets";
import { isRemoteNoteImageFont } from "@edgeever/shared/font-catalog";
import { resolveNoteImageTypography, type NoteImageFontStyle, type NoteImageTheme } from "@edgeever/shared/note-image-card";
import { FontLabel } from "@/components/FontLabel";

export const NoteImageFontLabel = ({ label, fontStyle, theme, enabled, visibleOnly = false, status, onStatusChange, retryKey }: {
  onStatusChange?: (status: FontLoadStatus) => void;
  status?: FontLoadStatus;
  retryKey?: number;
  label: string; fontStyle: NoteImageFontStyle; theme: NoteImageTheme; enabled: boolean; visibleOnly?: boolean;
}) => {
  const loadFont = useCallback((text: string) => prepareNoteImageAssets({ theme, fontStyle, text, urls: noteImageAssetUrls, embed: false }), [theme, fontStyle]);
  return <FontLabel onStatusChange={onStatusChange} status={status} retryKey={retryKey} label={label} fontId={isRemoteNoteImageFont(fontStyle) ? fontStyle : undefined} fontFamily={resolveNoteImageTypography(theme, fontStyle).bodyFamily} enabled={enabled} visibleOnly={visibleOnly} loadFont={loadFont} />;
};
