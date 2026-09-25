import { mergeAttributes, Node } from "@tiptap/core";

export const EMPTY_EXTERNAL_LINK_NODE_TYPE = "edgeeverEmptyExternalLink" as const;

const safeHref = (value: unknown) => {
  if (typeof value !== "string") return "";
  const href = value.trim();
  return /^(?:https?:\/\/|\/|#)/i.test(href) ? href : "";
};

/** A visible, round-trippable target for Markdown links with no label. */
export const EmptyExternalLink = Node.create({
  name: EMPTY_EXTERNAL_LINK_NODE_TYPE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: "" },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-edgeever-empty-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const href = safeHref(HTMLAttributes.href);
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: href || undefined,
        target: "_blank",
        rel: "noopener noreferrer",
        "data-edgeever-empty-link": "true",
        "aria-label": href ? `Open link: ${href}` : "Open link",
        class: "edgeever-empty-external-link",
      }),
      "↗",
    ];
  },

  renderMarkdown(node) {
    const href = safeHref(node.attrs?.href);
    if (!href) return "";
    const title = typeof node.attrs?.title === "string" && node.attrs.title
      ? ` "${node.attrs.title.replaceAll('"', '\\"')}"`
      : "";
    return `[](${href}${title})`;
  },
});
