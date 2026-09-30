export type EditorContentWidth = "standard" | "wide";

export const EDITOR_CONTENT_WIDTH_STORAGE_KEY = "edgeever.editorContentWidth";
export const EDITOR_CONTENT_ALIGNMENT_STORAGE_KEY = "edgeever.editorContentAlignment";

const EDITOR_CONTENT_COLUMN_WIDTHS = {
  standard: { reading: "880px", collapsed: "1200px", focus: "960px" },
  wide: { reading: "1040px", collapsed: "1280px", focus: "1120px" },
} as const;

export type EditorContentColumnMode = keyof (typeof EDITOR_CONTENT_COLUMN_WIDTHS)["standard"];

export const editorContentWidthFromStored = (
  width: string | null | undefined,
  legacyAlignment: string | null | undefined,
): EditorContentWidth => {
  if (width === "standard" || width === "wide") return width;
  return legacyAlignment === "start" ? "wide" : "standard";
};

export const editorContentColumnMaxWidth = (
  width: EditorContentWidth,
  mode: EditorContentColumnMode,
) => EDITOR_CONTENT_COLUMN_WIDTHS[width][mode];

const readStorage = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const readEditorContentWidthPreference = (): EditorContentWidth =>
  editorContentWidthFromStored(
    readStorage(EDITOR_CONTENT_WIDTH_STORAGE_KEY),
    readStorage(EDITOR_CONTENT_ALIGNMENT_STORAGE_KEY),
  );

export const writeEditorContentWidthPreference = (width: EditorContentWidth) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EDITOR_CONTENT_WIDTH_STORAGE_KEY, width);
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
};
