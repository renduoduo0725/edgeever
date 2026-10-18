import { PosterDocumentSchema, resizePosterDocument, type PosterDocument } from "@edgeever/shared";
import { ensureReadable, readableOn } from "./poster-design/vendor/qiaomu/quality";

const sectionId = /^(?:section-\d+-(?:card|accent|number|heading|body)|card-\d+-(?:bg|card|accent|number|title|heading|body))$/;
export const isSectionCard = (id: string) => /^(?:section-\d+-card|card-\d+-(?:bg|card))$/.test(id);
export const hasPosterSections = (document: PosterDocument) => document.elements.some(element => isSectionCard(element.id));
export const posterTemplateHeaderHeight = (document: PosterDocument, height: number) => hasPosterSections(document) ? Math.round(height * 0.36) : height;

const headerSemanticIds = ["content-header", "heading", "subtitle", "badge", "badge-text", "accent", "accent-bar", "footer", "footer-rule"];

// Template artwork owns the cover region. Semantic sections own the body region.
// Only known generated IDs are replaced; user-created objects remain independent.
export function composePosterTemplate(source: PosterDocument, cover: PosterDocument, width: number, height: number, headerHeight: number) {
  // Hairline rules must remain at least one document pixel after resizing.
  const scaled = resizePosterDocument({ ...source, elements: source.elements.map(element => ({ ...element, width: Math.max(element.width, source.width / width), height: Math.max(element.height, source.height / height) })) }, width, height);
  const structured = hasPosterSections(source);
  const isHeaderSemantic = (element: { id: string; role?: string }) =>
    element.id.startsWith("design_") ||
    headerSemanticIds.includes(element.id) ||
    element.role === "title" ||
    element.role === "subtitle" ||
    element.role === "badge";

  const extras = scaled.elements.filter(element => !isHeaderSemantic(element) && !(structured && sectionId.test(element.id)));
  if (!structured) return PosterDocumentSchema.parse({ ...cover, sourceMemoId: source.sourceMemoId, platformId: source.platformId, elements: [...cover.elements, ...extras] });

  const headerScale = headerHeight / cover.height;
  const header = cover.elements.map(element => ({ ...element, y: element.y * headerScale, height: Math.max(1, element.height * headerScale),
    ...(element.type === "text" ? { fontSize: Math.max(4, element.fontSize * headerScale) } : {}) }));
  const sections = scaled.elements.filter(element => sectionId.test(element.id));
  const cards = sections.filter(element => isSectionCard(element.id));
  const oldTop = Math.min(...cards.map(element => element.y));
  const oldBottom = Math.max(...cards.map(element => element.y + element.height));
  const unit = Math.min(width, height);
  const headerBottom = header.length > 0
    ? Math.max(...header.filter(e => e.role === "title" || e.role === "subtitle" || e.role === "badge" || e.id.startsWith("design_")).map(e => e.y + e.height), headerHeight)
    : headerHeight;
  const top = Math.max(headerHeight, headerBottom) + unit * 0.025;
  const bottom = scaled.elements.some(element => element.id === "footer") ? height * 0.88 : height - unit * 0.065;
  const bodyScale = Math.max(0.2, (bottom - top) / Math.max(1, oldBottom - oldTop));
  const backdrop = cover.elements.filter(element => element.type === "rect" && /^#[\da-f]{6}$/i.test(element.fill))
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const cardFill = backdrop && backdrop.type === "rect" ? backdrop.fill : cover.background;
  const ink = readableOn(cardFill);
  const badge = cover.elements.find(element => element.type === "text" && element.role === "badge");
  const accent = ensureReadable(badge?.type === "text" ? badge.fill : ink, cardFill);
  const body = sections.map(element => ({
    ...element,
    y: top + (element.y - oldTop) * bodyScale,
    height: Math.max(1, element.height * bodyScale),
    ...(element.type === "text"
      ? { fontSize: Math.max(4, element.fontSize * Math.min(1, bodyScale)), fill: element.id.endsWith("-number") ? accent : ink }
      : { fill: isSectionCard(element.id) ? cardFill : accent }),
  }));
  const footer = scaled.elements.filter(element => ["footer", "footer-rule"].includes(element.id)).map(element => ({ ...element, fill: readableOn(cover.background) }));
  return PosterDocumentSchema.parse({ ...cover, width, height, sourceMemoId: source.sourceMemoId, platformId: source.platformId,
    elements: [...header, ...body, ...footer, ...extras] });
}
