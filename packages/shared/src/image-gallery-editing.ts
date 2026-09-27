import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";
import { IMAGE_GALLERY_NODE_TYPE, isTransientImageUploadSource } from "./image-gallery";

const isCompletedImage = (node: ProseMirrorNode | null | undefined): node is ProseMirrorNode =>
  node?.type.name === "image" && !isTransientImageUploadSource(node.attrs.src);

const isSavedGallery = (
  node: ProseMirrorNode | null | undefined,
  inserted: ReadonlySet<ProseMirrorNode>,
): node is ProseMirrorNode =>
  !!node && node.type.name === IMAGE_GALLERY_NODE_TYPE && !inserted.has(node);

const locateTopLevel = (
  tr: Transaction,
  target: ProseMirrorNode,
): { node: ProseMirrorNode; pos: number } | null => {
  let found: { node: ProseMirrorNode; pos: number } | null = null;
  tr.doc.forEach((node, pos) => {
    if (node === target) found = { node, pos };
  });
  return found;
};

const expandCompletedImageRun = (tr: Transaction, pos: number, node: ProseMirrorNode) => {
  let start = pos;
  let end = pos + node.nodeSize;
  while (isCompletedImage(tr.doc.resolve(start).nodeBefore)) {
    start -= tr.doc.resolve(start).nodeBefore!.nodeSize;
  }
  while (isCompletedImage(tr.doc.resolve(end).nodeAfter)) {
    end += tr.doc.resolve(end).nodeAfter!.nodeSize;
  }
  return { start, end };
};

const wrapImageRun = (
  tr: Transaction,
  start: number,
  end: number,
  type: ProseMirrorNode["type"],
  attrs: ProseMirrorNode["attrs"],
) => {
  const range = tr.doc.resolve(start).blockRange(tr.doc.resolve(end));
  if (!range) return false;
  tr.wrap(range, [{ type, attrs }]);
  return true;
};

/**
 * Fold a completed upload into the images or gallery it touches.
 * Joining, rather than replacing a saved gallery, keeps selections inside it.
 * Unfinished upload placeholders stay put. Text, attachments, and a second
 * saved gallery still end the run.
 */
export const mergeUploadedImagesIntoAdjacentGalleries = (
  tr: Transaction,
  nodes: readonly ProseMirrorNode[],
) => {
  // Match node identities, not URLs, so other occurrences are left alone.
  const inserted = new Set(nodes);
  const pending: ProseMirrorNode[] = [];
  tr.doc.forEach((node) => {
    if (inserted.has(node) && (node.type.name === "image" || node.type.name === IMAGE_GALLERY_NODE_TYPE)) {
      pending.push(node);
    }
  });

  // Work backwards so a join does not invalidate a later upload's position.
  for (const candidate of pending.reverse()) {
    const current = locateTopLevel(tr, candidate);
    if (!current) continue;
    absorbUploadedNode(tr, current.node, current.pos, inserted);
  }
  return tr;
};

const absorbUploadedNode = (
  tr: Transaction,
  node: ProseMirrorNode,
  pos: number,
  inserted: ReadonlySet<ProseMirrorNode>,
) => {
  const galleryType = tr.doc.type.schema.nodes[IMAGE_GALLERY_NODE_TYPE];
  if (!galleryType) return;

  const { start, end } = expandCompletedImageRun(tr, pos, node);
  const previousGallery = isSavedGallery(tr.doc.resolve(start).nodeBefore, inserted)
    ? tr.doc.resolve(start).nodeBefore
    : null;
  // A new image between two saved galleries joins the earlier one only.
  const nextGallery = previousGallery
    ? null
    : isSavedGallery(tr.doc.resolve(end).nodeAfter, inserted)
      ? tr.doc.resolve(end).nodeAfter
      : null;
  const neighbor = previousGallery ?? nextGallery;
  const hasLooseImages = start < pos || end > pos + node.nodeSize;
  if (!hasLooseImages && !neighbor) return;

  if (node.type.name === "image") {
    const attrs = neighbor?.attrs ?? { layout: "auto" };
    if (!wrapImageRun(tr, start, end, neighbor?.type ?? galleryType, attrs)) return;
    if (previousGallery) {
      if (canJoin(tr.doc, start)) tr.join(start);
    } else if (nextGallery) {
      const wrapped = tr.doc.nodeAt(start);
      const joinAt = wrapped ? start + wrapped.nodeSize : null;
      if (joinAt !== null && canJoin(tr.doc, joinAt)) tr.join(joinAt);
    }
    return;
  }

  const attrs = neighbor?.attrs ?? node.attrs;
  let galleryPos = pos;
  if (end > pos + node.nodeSize) {
    const rightFrom = pos + node.nodeSize;
    if (wrapImageRun(tr, rightFrom, end, galleryType, attrs) && canJoin(tr.doc, rightFrom)) {
      tr.join(rightFrom);
    }
  }
  if (start < galleryPos) {
    if (wrapImageRun(tr, start, galleryPos, galleryType, attrs)) {
      const wrapped = tr.doc.nodeAt(start);
      const joinAt = wrapped ? start + wrapped.nodeSize : null;
      if (joinAt !== null && canJoin(tr.doc, joinAt)) {
        tr.join(joinAt);
        galleryPos = start;
      }
    }
  }

  const current = tr.doc.nodeAt(galleryPos);
  if (!current || current.type.name !== IMAGE_GALLERY_NODE_TYPE) return;
  const before = tr.doc.resolve(galleryPos).nodeBefore;
  const after = tr.doc.resolve(galleryPos + current.nodeSize).nodeAfter;
  if (isSavedGallery(before, inserted)) {
    if (canJoin(tr.doc, galleryPos)) tr.join(galleryPos);
  } else if (isSavedGallery(after, inserted)) {
    tr.setNodeMarkup(galleryPos, undefined, after.attrs);
    const joinAt = galleryPos + tr.doc.nodeAt(galleryPos)!.nodeSize;
    if (canJoin(tr.doc, joinAt)) tr.join(joinAt);
  }
};
