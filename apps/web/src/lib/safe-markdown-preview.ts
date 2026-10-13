import DOMPurify from "dompurify";
import { marked } from "marked";

// Render stored content as HTML, never as an active document. In particular,
// templates must not introduce SVG, CSS, frames, or privileged scheme links.
export const safeMarkdownPreview = (markdown: string) => DOMPurify.sanitize(
  marked.parse(markdown, { async: false }),
  {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style", "id", "name"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^:]*$)/i,
  },
);
