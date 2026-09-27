export const MEMO_EDITOR_READING_GUTTER_PROPERTIES_CLASS_NAME =
  "[--editor-reading-gutter:1rem] sm:[--editor-reading-gutter:1.75rem] lg:[--editor-reading-gutter:6rem]";

export const MEMO_EDITOR_READING_GUTTER_CLASS_NAME =
  `${MEMO_EDITOR_READING_GUTTER_PROPERTIES_CLASS_NAME} px-[var(--editor-reading-gutter)]`;

export const MEMO_EDITOR_TOP_ROW_CLASS_NAME =
  "relative flex min-h-12 items-center justify-between gap-2 border-b border-slate-100 py-2 sm:min-h-9 sm:py-0.5";

export const MEMO_EDITOR_TOOLBAR_PADDING_CLASS_NAME =
  "px-3 py-2 sm:px-4 sm:py-0.5";

/** One control row: py-2 + h-8 on mobile, py-0.5 + h-8 on sm+. */
export const MEMO_EDITOR_TOOLBAR_COLLAPSED_CLASS_NAME =
  "max-h-12 overflow-hidden sm:max-h-9";

/** Extra right inset so the title field stops before the header status cluster. */
export const nextTitleStatusClearance = (
  current: number,
  inputRight: number,
  statusLeft: number,
  gap = 8,
) => {
  const next = Math.min(480, Math.max(0, Math.ceil(current + inputRight - (statusLeft - gap))));
  return Math.abs(next - current) <= 1 ? current : next;
};
