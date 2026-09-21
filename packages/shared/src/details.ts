import type { JSONContent, MarkdownParseHelpers, MarkdownRendererHelpers, MarkdownToken } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";

export const DETAILS_NODE_TYPE = "details" as const;
export const DETAILS_SUMMARY_NODE_TYPE = "detailsSummary" as const;
export const DETAILS_CONTENT_NODE_TYPE = "detailsContent" as const;

const DETAILS_OPEN_PATTERN = /^<details\b([^>]*)>/i;
const SUMMARY_PATTERN = /^\s*<summary\b[^>]*>([\s\S]*?)<\/summary\s*>\s*/i;
const DETAILS_CONTENT_WRAPPER_PATTERN =
  /^\s*<div\b[^>]*data-type=["']detailsContent["'][^>]*>([\s\S]*)<\/div>\s*$/i;

const collectText = (node: JSONContent | undefined): string => {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map((child) => collectText(child)).join("");
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");

const stripHtmlTags = (value: string) => decodeHtmlEntities(value.replace(/<[^>]+>/g, "")).trim();

const findHtmlBlock = (source: string, tag: string) => {
  const open = new RegExp(`^<${tag}\\b([^>]*)>`, "i").exec(source);
  if (!open) return null;

  const openTag = open[0];
  let depth = 1;
  let index = openTag.length;
  const openPattern = new RegExp(`<${tag}\\b`, "ig");
  const closePattern = new RegExp(`</${tag}\\s*>`, "ig");

  while (index < source.length && depth > 0) {
    openPattern.lastIndex = index;
    closePattern.lastIndex = index;
    const nextOpen = openPattern.exec(source);
    const nextClose = closePattern.exec(source);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      index = nextOpen.index + nextOpen[0].length;
      continue;
    }
    depth -= 1;
    index = nextClose.index + nextClose[0].length;
    if (depth === 0) {
      return {
        raw: source.slice(0, index),
        inner: source.slice(openTag.length, nextClose.index),
      };
    }
  }

  return null;
};

const unwrapDetailsContent = (inner: string) => {
  const match = DETAILS_CONTENT_WRAPPER_PATTERN.exec(inner.trim());
  return match ? match[1] : inner;
};

const htmlImagesToMarkdown = (source: string) =>
  source.replace(/<img\b([^>]*)\/?>/gi, (tag, attrs: string) => {
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const alt = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const title = /\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const url = (src?.[1] ?? src?.[2] ?? src?.[3] ?? "").trim();
    if (!url) return tag;
    const altText = (alt?.[1] ?? alt?.[2] ?? alt?.[3] ?? "").trim();
    const titleText = (title?.[1] ?? title?.[2] ?? title?.[3] ?? "").trim();
    return titleText ? `![${altText}](${url} "${titleText}")` : `![${altText}](${url})`;
  });

/**
 * GitHub-style HTML paste uses <details><summary>…</summary>blocks</details>.
 * TipTap's schema expects the body wrapped in div[data-type=detailsContent].
 */
export const wrapDetailsContentHtml = (html: string): string => {
  if (typeof DOMParser === "undefined" || !html.includes("<details")) {
    return html;
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const blocks = [...document.querySelectorAll("details")].reverse();
  for (const details of blocks) {
    if (details.querySelector(':scope > [data-type="detailsContent"]')) continue;
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-type", "detailsContent");
    for (const child of [...details.childNodes]) {
      if (child.nodeName === "SUMMARY") continue;
      wrapper.appendChild(child);
    }
    if (!wrapper.hasChildNodes()) {
      wrapper.appendChild(document.createElement("p"));
    }
    const summary = details.querySelector(":scope > summary");
    if (summary?.nextSibling) {
      details.insertBefore(wrapper, summary.nextSibling);
    } else {
      details.appendChild(wrapper);
    }
  }
  return document.body.innerHTML;
};

/** WeChat and similar HTML sinks do not honor <details>, so unwrap to visible title + body. */
export const flattenDetailsForLinearHtml = (root: HTMLElement) => {
  const document = root.ownerDocument;
  if (!document) return;

  const blocks = [...root.querySelectorAll("details")].reverse();
  for (const details of blocks) {
    const replacement = document.createElement("div");
    replacement.className = "edgeever-details-flat";
    const summary = details.querySelector(":scope > summary");
    const title = summary?.textContent?.trim();
    if (title) {
      const heading = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = title;
      heading.appendChild(strong);
      replacement.appendChild(heading);
    }
    for (const child of [...details.childNodes]) {
      if (child === summary) continue;
      if (child instanceof HTMLElement && child.getAttribute("data-type") === "detailsContent") {
        while (child.firstChild) {
          replacement.appendChild(child.firstChild);
        }
        continue;
      }
      replacement.appendChild(child);
    }
    details.parentNode?.replaceChild(replacement, details);
  }
};

export const DETAILS_EDITOR_CSS = `
.ProseMirror [data-type="details"],
.edgeever-editor-content [data-type="details"] {
  display: flex;
  align-items: flex-start;
  gap: 0.1em;
  margin: 0.15em 0;
  padding: 0;
  border: 0;
  background: transparent;
}
.ProseMirror [data-type="details"] > button,
.edgeever-editor-content [data-type="details"] > button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 1.6em;
  height: 1.6em;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #16a06e;
  font: inherit;
  line-height: 0;
  cursor: pointer;
}
.ProseMirror [data-type="details"] > button:hover,
.edgeever-editor-content [data-type="details"] > button:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.ProseMirror [data-type="details"] > button:focus-visible,
.edgeever-editor-content [data-type="details"] > button:focus-visible {
  outline: 2px solid color-mix(in srgb, #16a06e 55%, transparent);
  outline-offset: 1px;
}
.ProseMirror [data-type="details"] > button::before,
.edgeever-editor-content [data-type="details"] > button::before {
  content: "";
  width: 0.32em;
  height: 0.32em;
  margin: 0;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
}
.ProseMirror [data-type="details"].is-open > button::before,
.edgeever-editor-content [data-type="details"].is-open > button::before {
  transform: rotate(45deg);
}
.ProseMirror [data-type="details"] > div,
.edgeever-editor-content [data-type="details"] > div {
  flex: 1;
  min-width: 0;
}
.ProseMirror summary,
.edgeever-editor-content summary {
  display: block;
  margin: 0;
  padding: 0;
  font-size: inherit;
  font-weight: 500;
  line-height: inherit;
  list-style: none;
  cursor: text;
}
.ProseMirror summary::-webkit-details-marker,
.edgeever-editor-content summary::-webkit-details-marker {
  display: none;
}
.ProseMirror [data-type="details"]:not(.is-open) [data-type="detailsContent"],
.edgeever-editor-content [data-type="details"]:not(.is-open) [data-type="detailsContent"] {
  display: none !important;
}
.ProseMirror [data-type="details"].is-open [data-type="detailsContent"],
.edgeever-editor-content [data-type="details"].is-open [data-type="detailsContent"] {
  margin-top: 0.15em;
}
`;

const parseDetailsMarkdown = (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
  const summaryText = typeof token.summary === "string" ? token.summary : "";
  const parsedBody = helpers.parseChildren(token.tokens || []);
  const body = parsedBody.length > 0 ? parsedBody : [{ type: "paragraph" }];
  return helpers.createNode(DETAILS_NODE_TYPE, undefined, [
    helpers.createNode(
      DETAILS_SUMMARY_NODE_TYPE,
      undefined,
      summaryText ? [helpers.createTextNode(summaryText)] : [],
    ),
    helpers.createNode(DETAILS_CONTENT_NODE_TYPE, undefined, body),
  ]);
};

const renderDetailsMarkdown = (node: JSONContent, helpers: MarkdownRendererHelpers) => {
  const children = Array.isArray(node.content) ? node.content : [];
  const summary = children.find((child) => child.type === DETAILS_SUMMARY_NODE_TYPE);
  const body = children.find((child) => child.type === DETAILS_CONTENT_NODE_TYPE);
  const summaryHtml = escapeHtml(collectText(summary).trim());
  const bodyMarkdown = Array.isArray(body?.content) && body.content.length > 0
    ? helpers.renderChildren(body.content, "\n\n").trim()
    : "";
  return `<details>\n<summary>${summaryHtml}</summary>\n\n${bodyMarkdown}\n\n</details>`;
};

export const EdgeEverDetails = Details.extend({
  addOptions() {
    return {
      persist: false,
      openClassName: "is-open",
      HTMLAttributes: {
        class: "edgeever-details",
      },
      renderToggleButton: ({ element, isOpen }) => {
        element.setAttribute("aria-label", isOpen ? "Collapse details" : "Expand details");
      },
    };
  },

  parseMarkdown: parseDetailsMarkdown,
  renderMarkdown: renderDetailsMarkdown,
  markdownTokenizer: {
    name: DETAILS_NODE_TYPE,
    level: "block",
    start(source: string) {
      const match = /<details\b/i.exec(source);
      return match ? match.index : -1;
    },
    tokenize(source: string, _tokens, lexer) {
      const leading = /^\s*/.exec(source)?.[0] ?? "";
      const rest = source.slice(leading.length);
      if (!DETAILS_OPEN_PATTERN.test(rest)) return undefined;
      const block = findHtmlBlock(rest, "details");
      if (!block) return undefined;

      const summaryMatch = SUMMARY_PATTERN.exec(block.inner);
      const summary = summaryMatch ? stripHtmlTags(summaryMatch[1]) : "";
      const bodySource = htmlImagesToMarkdown(unwrapDetailsContent(
        summaryMatch ? block.inner.slice(summaryMatch[0].length) : block.inner,
      ));
      const tokens = bodySource.trim() ? lexer.blockTokens(bodySource.trim()) : [];
      const trailing = /^\s*\n/.exec(source.slice(leading.length + block.raw.length))?.[0] ?? "";

      return {
        type: DETAILS_NODE_TYPE,
        raw: `${leading}${block.raw}${trailing}`,
        summary,
        tokens,
      };
    },
  },
});

export const EdgeEverDetailsSummary = DetailsSummary;
export const EdgeEverDetailsContent = DetailsContent;

export const createEdgeEverDetailsExtensions = () => [
  EdgeEverDetails,
  EdgeEverDetailsSummary,
  EdgeEverDetailsContent,
];
