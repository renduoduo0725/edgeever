const escapeMarkdownLabel = (value: string) =>
  value.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");

const markdownDestination = (value: string) =>
  value.replace(/\\/g, "%5C").replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

export const selectionNoteTitle = (text: string, pageTitle: string, fallback: string) => {
  const excerpt = text.replace(/\s+/g, " ").trim();
  const page = pageTitle.replace(/\s+/g, " ").trim();
  return (excerpt || page || fallback).slice(0, 80);
};

export const selectionNoteMarkdown = (input: {
  markdown: string;
  pageUrl: string;
  capturedAt: string;
  sourceLabel: string;
  capturedAtLabel: string;
}) => {
  const body = input.markdown.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const footer = [
    `${input.sourceLabel}: [${escapeMarkdownLabel(input.pageUrl)}](${markdownDestination(input.pageUrl)})`,
    `${input.capturedAtLabel}: ${input.capturedAt}`,
  ].join("\n\n");
  return body ? `${body}\n\n${footer}` : footer;
};
