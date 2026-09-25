import Link from "@tiptap/extension-link";
import { EMPTY_EXTERNAL_LINK_NODE_TYPE } from "./empty-external-link";

/**
 * Keep text entered at the end of a link outside that link while preserving
 * TipTap's automatic URL detection and link-on-paste behavior.
 */
export const EdgeEverLink = Link.extend({
  inclusive: false,
  parseMarkdown(token, helpers) {
    if (!token.tokens?.length && token.text === "" && typeof token.href === "string" && token.href) {
      return {
        type: EMPTY_EXTERNAL_LINK_NODE_TYPE,
        attrs: { href: token.href, title: token.title || null },
      };
    }
    return helpers.applyMark("link", helpers.parseInline(token.tokens || []), {
      href: token.href,
      title: token.title || null,
    });
  },
});
