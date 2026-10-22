import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * In-note Markdown heading links such as `[章节](#章节名)`.
 * The match is computed at click time from heading text. Ids are not stored.
 */

export type HeadingAnchor = {
  pos: number;
  text: string;
};

type HeadingAnchorClick = {
  button: number;
  target: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
};

/** Bare `#fragment` only. Note links and every other href stay untouched. */
export const parseHeadingAnchorHref = (href: string | null | undefined): string | null => {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed.startsWith("#") || trimmed.startsWith("#memo=")) return null;
  const encoded = trimmed.slice(1);
  if (!encoded) return null;
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded.replace(/\+/g, "%20"));
  } catch {
    decoded = encoded;
  }
  const fragment = decoded.trim();
  return fragment || null;
};

/** GitHub-style heading key: case-folded, with spaces and punctuation collapsed. */
export const headingAnchorKey = (value: string): string =>
  value
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

export const collectHeadingAnchors = (doc: ProseMirrorNode): HeadingAnchor[] => {
  const headings: HeadingAnchor[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (text) headings.push({ pos, text });
  });
  return headings;
};

/** First heading whose text matches the fragment. Later duplicates stay put. */
export const findHeadingAnchor = (
  headings: readonly HeadingAnchor[],
  fragment: string,
): HeadingAnchor | null => {
  const key = headingAnchorKey(fragment);
  if (!key) return null;
  return headings.find((heading) => headingAnchorKey(heading.text) === key) ?? null;
};

const headingElement = (view: EditorView, pos: number): HTMLElement | null => {
  try {
    const direct = view.nodeDOM(pos);
    if (direct instanceof HTMLElement) return direct;
    const found = view.domAtPos(pos);
    if (found.node instanceof HTMLElement) return found.node;
    return found.node.parentElement;
  } catch {
    return null;
  }
};

const revealHeading = (element: HTMLElement) => {
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === "DETAILS") (parent as HTMLDetailsElement).open = true;
    parent = parent.parentElement;
  }
};

export const scrollViewToHeading = (view: EditorView, pos: number) => {
  const element = headingElement(view, pos);
  if (element) revealHeading(element);
  try {
    const max = view.state.doc.content.size;
    const target = Math.min(pos + 1, max);
    if (target >= 1) {
      const selection = TextSelection.near(view.state.doc.resolve(target));
      // Place the caret first. A selection update cancels an in-flight smooth scroll.
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
      view.focus();
    }
  } catch {
    // The heading can still scroll into view when the caret cannot move.
  }
  element?.scrollIntoView({ behavior: "smooth", block: "start" });
};

/**
 * Consume a primary click on an in-note heading link.
 * Returns false for every other click so note links, web links, and attachments proceed.
 */
export const activateHeadingAnchorClick = (
  event: HeadingAnchorClick,
  view: EditorView | null | undefined,
): boolean => {
  if (event.button !== 0) return false;
  const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!target) return false;
  const fragment = parseHeadingAnchorHref(target.getAttribute("href"));
  if (!fragment) return false;
  event.preventDefault();
  event.stopPropagation();
  if (!view) return true;
  const match = findHeadingAnchor(collectHeadingAnchors(view.state.doc), fragment);
  if (match) scrollViewToHeading(view, match.pos);
  return true;
};
