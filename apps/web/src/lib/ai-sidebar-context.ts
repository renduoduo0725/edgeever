import type { CompanionTurnInput } from "@edgeever/shared";

export type SidebarNoteContext = {
  memoId?: string;
  notebookId?: string;
  notebookTitle?: string;
  noteTitle?: string;
  selectionMarkdown?: string;
  contentMarkdown?: string;
};

export const sidebarCompanionFocus = (context: SidebarNoteContext, includeCurrentNote: boolean): CompanionTurnInput["focus"] => {
  const selection = context.selectionMarkdown?.trim().slice(0, 2000) ?? "";
  const next: NonNullable<CompanionTurnInput["focus"]> = {};
  if (includeCurrentNote) {
    if (context.memoId) next.memoId = context.memoId;
    if (context.notebookId) next.notebookId = context.notebookId;
    if (context.notebookTitle) next.notebookTitle = context.notebookTitle;
    if (context.noteTitle?.trim()) next.title = context.noteTitle.trim();
    const content = context.contentMarkdown?.trim() ?? "";
    if (content) {
      next.contentMarkdown = content.slice(0, 4000);
      if (content.length > 4000) next.contentTruncated = true;
    }
  }
  if (selection) next.selectionMarkdown = selection;
  return Object.keys(next).length ? next : undefined;
};

export const sidebarLocalContextText = (context: SidebarNoteContext, includeCurrentNote: boolean): string => {
  const selection = context.selectionMarkdown?.trim().slice(0, 2000);
  const content = includeCurrentNote ? context.contentMarkdown?.trim().slice(0, 2000) : "";
  return [
    selection ? `Selected text from the current note (data):\n${selection}` : "",
    includeCurrentNote && context.noteTitle?.trim() ? `Current note title (data): ${context.noteTitle.trim()}` : "",
    content ? `Current note body (data):\n${content}` : "",
  ].filter(Boolean).join("\n\n");
};
