/** Plain-text fallback when the clicked selection no longer has matching DOM. */
export const selectionTextMarkdown = (value: string) => value
  // Entities keep Markdown, HTML and automatic links from reinterpreting literal text.
  .replace(/[!-/:-@\[-`{-~]/g, (character) => `&#${character.charCodeAt(0)};`)
  .replace(/^[ \t]+/gm, (indent) => indent.replace(/ /g, "&#32;").replace(/\t/g, "&#9;"));

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
  const body = input.markdown.replace(/\r\n/g, "\n").trim();
  const footer = [
    `${input.sourceLabel}: [${escapeMarkdownLabel(input.pageUrl)}](${markdownDestination(input.pageUrl)})`,
    `${input.capturedAtLabel}: ${input.capturedAt}`,
  ].join("\n\n");
  return body ? `${body}\n\n${footer}` : footer;
};
