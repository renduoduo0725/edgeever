import { PosterElementSchema, type PosterDocument, type PosterElement } from "@edgeever/shared";
export type ImageSlot = { x: number; y: number; width: number; height: number };
export function matchesImageSlot(element: PosterElement, slot?: ImageSlot) {
  return element.type === "rect" && Boolean(slot) && element.id.startsWith("design_") && Math.abs(element.rotation) < 0.01
    && ["x", "y", "width", "height"].every(key => Math.abs(element[key as keyof ImageSlot] - slot![key as keyof ImageSlot]) < 2);
}
export function posterImageReplacementTarget(document: PosterDocument, targetId?: string, point?: { x: number; y: number }, slot?: ImageSlot) {
  const target = document.elements.find(element => element.id === targetId);
  if (!target || target.locked || target.visible === false || target.type === "text") return;
  if (target.type === "image" || target.imagePlaceholder || matchesImageSlot(target, slot)) return target;
  // A decorative glow can be on top of a photo placeholder. Hit the declared
  // image region underneath it, never an arbitrary rectangle or text block.
  if (!point || !target.id.startsWith("design_")) return;
  return [...document.elements].reverse().find(element => !element.locked && element.visible !== false && (element.imagePlaceholder || (element.type === "image" && element.id.startsWith("design_")) || matchesImageSlot(element, slot))
    && Math.abs(element.rotation) < 0.01 && point.x >= element.x && point.x <= element.x + element.width && point.y >= element.y && point.y <= element.y + element.height);
}
export function replacePosterImage(element: PosterElement, resourceId: string, imageWidth: number, imageHeight: number): PosterElement {
  if ((element.type !== "image" && element.type !== "rect") || element.locked || element.visible === false) throw new Error("Poster image is missing or locked");
  const ratio = imageWidth / imageHeight;
  const frame = element.width / element.height;
  const cropWidth = Math.min(1, frame / ratio);
  const cropHeight = Math.min(1, ratio / frame);
  return PosterElementSchema.parse({ ...element, type: "image", resourceId, imagePlaceholder: undefined, gradient: undefined,
    crop: element.type === "image" && element.crop ? element.crop : { x: (1 - cropWidth) / 2, y: (1 - cropHeight) / 2, width: cropWidth, height: cropHeight } });
}
