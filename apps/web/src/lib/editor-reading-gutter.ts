/** Desktop reading gutter at the `lg` breakpoint. Matches `6rem` in the editor row. */
export const EDITOR_DESKTOP_READING_GUTTER_PX = 96;

/** Compact gutter already used below `lg` and in the tight pane. Matches `1.75rem`. */
export const EDITOR_COMPACT_READING_GUTTER = "1.75rem";

/**
 * Hide the outline below this projected editor-column width.
 * Outline (300px) plus 6rem gutters would otherwise collapse the article.
 */
export const EDITOR_PANE_TIGHT_PX = 720;

/** Tailwind `gap-8` between the article and an in-flow outline. */
export const EDITOR_ARTICLE_ROW_GAP_PX = 32;

/** Focus mode caps the article row. Matches `max-w-[1400px]` on that row. */
export const EDITOR_FOCUS_ROW_MAX_PX = 1400;

export const editorColumnFitsDesktopReadingGutters = ({
  columnWidth,
  articleMaxWidth,
  reservedBesideArticle = 0,
}: {
  columnWidth: number;
  articleMaxWidth: number;
  reservedBesideArticle?: number;
}) =>
  columnWidth >= articleMaxWidth + reservedBesideArticle + EDITOR_DESKTOP_READING_GUTTER_PX * 2;

/**
 * While the companion sidebar is open, yield the 6rem reading gutters as soon
 * as the column can no longer hold the chosen article width, the outline, and
 * those gutters. The shared `lg:` gutter stays 6rem for every other width.
 */
export const shouldCompactEditorReadingGutter = ({
  aiAssistantOpen,
  desktopColumn,
  columnWidth,
  articleMaxWidth,
  reservedBesideArticle = 0,
  focusRow = false,
}: {
  aiAssistantOpen: boolean;
  desktopColumn: boolean;
  columnWidth: number;
  articleMaxWidth: number;
  reservedBesideArticle?: number;
  focusRow?: boolean;
}) => {
  if (!aiAssistantOpen || !desktopColumn || columnWidth <= 0) return false;
  if (!Number.isFinite(articleMaxWidth) || articleMaxWidth <= 0) return false;
  const available = focusRow ? Math.min(columnWidth, EDITOR_FOCUS_ROW_MAX_PX) : columnWidth;
  return !editorColumnFitsDesktopReadingGutters({
    columnWidth: available,
    articleMaxWidth,
    reservedBesideArticle,
  });
};
