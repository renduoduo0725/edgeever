export type SystemInfoClipboardItem = {
  label: string;
  value: string;
};

export type SystemInfoClipboardGroup = {
  title: string;
  items: SystemInfoClipboardItem[];
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const escapeMarkdownTableCell = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\\", "\\\\")
  .replaceAll("|", "\\|")
  .replace(/\r?\n/g, "<br>");

export const formatSystemInfoClipboard = ({
  fieldLabel,
  groups,
  title,
  valueLabel,
}: {
  fieldLabel: string;
  groups: SystemInfoClipboardGroup[];
  title: string;
  valueLabel: string;
}) => {
  const plainText = [
    `# ${title}`,
    ...groups.map((group) => [
      `## ${group.title}`,
      `| ${escapeMarkdownTableCell(fieldLabel)} | ${escapeMarkdownTableCell(valueLabel)} |`,
      "| --- | --- |",
      ...group.items.map((item) => (
        `| ${escapeMarkdownTableCell(item.label)} | ${escapeMarkdownTableCell(item.value)} |`
      )),
    ].join("\n")),
  ].join("\n\n");

  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    ...groups.map((group) => [
      `<h2>${escapeHtml(group.title)}</h2>`,
      "<table>",
      `<thead><tr><th>${escapeHtml(fieldLabel)}</th><th>${escapeHtml(valueLabel)}</th></tr></thead>`,
      "<tbody>",
      ...group.items.map((item) => (
        `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`
      )),
      "</tbody>",
      "</table>",
    ].join("")),
  ].join("");

  return { html, plainText };
};
