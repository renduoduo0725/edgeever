import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { markdownToDoc, type TiptapDoc } from "@edgeever/shared";
import { docToEditableMarkdown } from "./editor-mode-content";

const CURSOR_MARKER = "\uE000EDGEEVERCURSOR\uE001";

/** Map a rich-text position only if adding a temporary marker leaves the source unchanged. */
export const richPositionToMarkdownOffset = (
  doc: ProseMirrorNode,
  markdownSource: string,
  position: number,
): number | null => {
  if (position < 0 || position > doc.content.size || markdownSource.includes(CURSOR_MARKER)) return null;

  try {
    const markedDoc = EditorState.create({ doc }).tr.insertText(CURSOR_MARKER, position).doc;
    if (markedDoc.eq(doc)) return null;
    const markedSource = docToEditableMarkdown(markedDoc.toJSON() as TiptapDoc);
    const offset = markedSource.indexOf(CURSOR_MARKER);
    if (offset < 0 || markedSource.indexOf(CURSOR_MARKER, offset + 1) !== -1) return null;

    return markedSource.replace(CURSOR_MARKER, "") === markdownSource ? offset : null;
  } catch {
    return null;
  }
};

/** A source offset is safe when parsing around it recreates the same rich document. */
export const markdownOffsetToRichPosition = (
  schema: Schema,
  doc: ProseMirrorNode,
  markdownSource: string,
  offset: number,
): number | null => {
  if (offset < 0 || offset > markdownSource.length || markdownSource.includes(CURSOR_MARKER)) return null;

  try {
    const markedSource = `${markdownSource.slice(0, offset)}${CURSOR_MARKER}${markdownSource.slice(offset)}`;
    const markedDoc = schema.nodeFromJSON(markdownToDoc(markedSource));
    let position: number | null = null;
    markedDoc.descendants((node, start) => {
      if (!node.isText) return;
      const index = node.text?.indexOf(CURSOR_MARKER) ?? -1;
      if (index !== -1) position = start + index;
    });
    if (position === null) return null;

    const restored = EditorState.create({ doc: markedDoc }).tr.delete(position, position + CURSOR_MARKER.length).doc;
    return restored.eq(doc) ? position : null;
  } catch {
    return null;
  }
};
