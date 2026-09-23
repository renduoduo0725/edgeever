import {
  hasDiagramDocumentMarker,
  hasTableDocumentMarker,
  markdownToDoc,
  parseDiagramDocument,
  parseTableDocument,
  resolveMemoContentDoc,
  rewriteMemoResourcesForShare,
  stripDiagramDocumentMarker,
  stripTableDocumentMarker,
  tableFallbackMarkdown,
  type DiagramDocument,
  type PublicMemoShare,
  type TiptapDoc,
} from "@edgeever/shared";

export type PublicShareBody =
  | { type: "diagram"; diagram: DiagramDocument }
  | { type: "rich-text"; content: TiptapDoc };

/** Visual diagram notes share through IR → X6. Ordinary notes, including embedded Mermaid fences, stay on TipTap. */
export const resolvePublicShareBody = (share: PublicMemoShare, token: string): PublicShareBody => {
  const diagram = parseDiagramDocument(share.contentMarkdown);
  if (diagram) return { type: "diagram", diagram };
  const table = parseTableDocument(share.contentMarkdown);
  if (table) {
    return { type: "rich-text", content: rewriteMemoResourcesForShare(markdownToDoc(tableFallbackMarkdown(table)), token, share.memoShareTokens) };
  }
  const richText = hasDiagramDocumentMarker(share.contentMarkdown) || hasTableDocumentMarker(share.contentMarkdown)
    ? markdownToDoc(hasTableDocumentMarker(share.contentMarkdown) ? stripTableDocumentMarker(share.contentMarkdown) : stripDiagramDocumentMarker(share.contentMarkdown))
    : resolveMemoContentDoc(share.contentJson, share.contentMarkdown);
  return {
    type: "rich-text",
    content: rewriteMemoResourcesForShare(richText, token, share.memoShareTokens),
  };
};
