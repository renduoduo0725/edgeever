const escapeLabel = (value: string) => value
  .replaceAll("\\", "\\\\")
  .replace(/[\[\]\r\n]/g, (character) => character === "\r" || character === "\n" ? " " : `\\${character}`);

export const resourceToMarkdown = (resource: { kind: "image" | "attachment"; url: string; filename: string | null }, fallbackName: string) => {
  const label = escapeLabel(resource.filename || fallbackName || "file");
  const url = resource.url.replaceAll("(", "%28").replaceAll(")", "%29");
  return `${resource.kind === "image" ? "!" : ""}[${label}](${url})`;
};
