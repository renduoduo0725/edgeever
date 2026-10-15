import type { MemoTemplate } from "@edgeever/shared";
import { localizeDefaultMemoTemplate } from "@edgeever/shared/memo-template-seeds";

export type TemplateCard = {
  /** The template as stored; editing starts from it. */
  template: MemoTemplate;
  /** The template as shown in the current UI language. */
  display: MemoTemplate;
};

export type TemplateDraft = {
  name: string;
  description: string;
  title: string;
  contentMarkdown: string;
  tags: string;
};

// Unedited default templates are displayed in the UI language, but the editor
// always starts from the stored fields, so saving a change to one field never
// writes the display translation of the others.
export const createTemplateCards = (
  templates: readonly MemoTemplate[],
  locale: string | null | undefined,
): TemplateCard[] => templates.map((template) => ({
  template,
  display: localizeDefaultMemoTemplate(template, locale),
}));

export const createTemplateDraft = (template: MemoTemplate): TemplateDraft => ({
  name: template.name,
  description: template.description ?? "",
  title: template.title ?? "",
  contentMarkdown: template.contentMarkdown,
  tags: template.tags.join(", "),
});

export const templateDraftToPayload = (draft: TemplateDraft) => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  title: draft.title.trim() || null,
  contentMarkdown: draft.contentMarkdown,
  tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
});
