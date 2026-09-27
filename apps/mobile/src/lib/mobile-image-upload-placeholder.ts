import {
  isTransientImageUploadSource,
  normalizeImageGalleries,
  TRANSIENT_IMAGE_UPLOAD_PREFIX,
  type TiptapDoc,
  type TiptapNode,
} from "@edgeever/shared";

export const createMobileImageUploadPlaceholderSource = (id: string) =>
  `${TRANSIENT_IMAGE_UPLOAD_PREFIX}${id}`;

export const isMobileImageUploadPlaceholderSource = isTransientImageUploadSource;

export const stripMobileImageUploadPlaceholders = (doc: TiptapDoc): TiptapDoc => {
  const stripNodes = (nodes: TiptapNode[]): TiptapNode[] => nodes.flatMap((node) => {
    if (node.type === "image" && isMobileImageUploadPlaceholderSource(node.attrs?.src)) {
      return [];
    }

    return [{
      ...node,
      ...(node.content ? { content: stripNodes(node.content as TiptapNode[]) } : {}),
    }];
  });

  const content = stripNodes(doc.content);
  return normalizeImageGalleries({
    ...doc,
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  });
};
