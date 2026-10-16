import type { MarkdownToken } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";

// GFM cells use <br> for line breaks, including our own table serializer.
// Recognize only this attribute-free token inside cells; arbitrary HTML and
// literal tags inside text/code keep the normal Markdown safety boundary.
const cellTokens = (tokens: MarkdownToken[]): MarkdownToken[] => tokens.map((token) =>
  token.type === "html" && /^<br\s*\/?>$/i.test(token.raw || "")
    ? { type: "br", raw: token.raw }
    : token.tokens ? { ...token, tokens: cellTokens(token.tokens) } : token,
);

export const EdgeEverTableKit = TableKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map((extension) => {
      if(extension.name !== "table") return extension;
      const parseMarkdown=extension.config.parseMarkdown!;
      return extension.extend({
        parseMarkdown(token, helpers) {
          const cell = (value: { tokens: MarkdownToken[] }) => ({ ...value, tokens: cellTokens(value.tokens) });
          return parseMarkdown.call(this,{
            ...token,
            header: token.header?.map(cell),
            rows: token.rows?.map((row: Array<{ tokens: MarkdownToken[] }>) => row.map(cell)),
          }, helpers);
        },
      });
    });
  },
});
