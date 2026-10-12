import { z } from "zod";
import { createPosterDocument, POSTER_FORMATS, POSTER_TEMPLATES, PosterDocumentSchema, PosterGradientSchema, PosterElementSchema, PosterPaintGradientSchema, resizePosterDocument, PLATFORMS, POSTER_FONTS, POSTER_DESIGN_TEMPLATES, type PosterDocument } from "@edgeever/shared";
import { AppError } from "./app-error";
import { layoutPosterContent } from "./poster-content-layout";

const creation = z.object({
  notebookId: z.string().min(1),
  title: z.string().min(1).max(160),
  heading: z.string().trim().min(1).max(80),
  subtitle: z.string().max(240).default(""),
  template: z.enum(POSTER_TEMPLATES).default("editorial"),
  format: z.enum(["portrait", "square", "wechat", "video", "story"]).default("portrait"),
  badge: z.string().trim().max(24).default(""),
  footer: z.string().trim().max(100).default(""),
  layout: z.enum(["auto", "grid", "list"]).default("auto"),
  sections: z.array(z.object({ heading: z.string().trim().min(1).max(32), body: z.string().trim().min(1).max(120) }).strict()).min(2).max(6).optional(),
  tags: z.array(z.string()).max(100).optional(),
}).strict();

// Agents supply copy, not the encoded document or hand-written canvas geometry.
export function compilePosterMemo(input: unknown) {
  const parsed = creation.safeParse(input);
  if (!parsed.success) throw new AppError("invalid_params", "Invalid poster input. Supply notebookId, title and a short heading; use create_poster_memo, never encoded Markdown.", 400);
  const args = parsed.data;
  const format = POSTER_FORMATS.find(format => format.id === args.format)!;
  const document = createPosterDocument(args.heading, args.subtitle, args.template, format.width, format.height);
  document.templateId = args.template;
  document.copy = { title: args.heading, subtitle: args.subtitle, badge: "" };
  if (args.sections) {
    layoutPosterContent(document, { ...args, sections: args.sections });
    return { args, document: PosterDocumentSchema.parse(document) };
  }
  if (args.badge || args.footer || args.layout !== "auto") throw new AppError("invalid_params", "Structured layout, badge and footer require sections. Omit them for a headline-only poster.", 400);
  for (const element of document.elements) {
    if (element.type !== "text") continue;
    element.role = element.id === "heading" ? "title" : "subtitle";
    element.sourceText = element.text;
    // Reserve separate title/body regions and fit conservative CJK line widths.
    // Explicit newlines count too, so long copy does not overlap the other block.
    const height = document.height * (element.role === "title" ? 0.38 : 0.22);
    const lines = () => element.text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(Array.from(line).length * element.fontSize / element.width)), 0);
    while (element.fontSize > 16 && lines() * element.fontSize * 1.4 > height) element.fontSize--;
    if (lines() * element.fontSize * 1.4 > height) throw new AppError("invalid_params", "Poster copy does not fit. Shorten the text or remove extra line breaks.", 400);
    element.height = height;
    element.lineHeight = 1.4;
  }
  return { args, document: PosterDocumentSchema.parse(document) };
}

export const posterPatchSchema = z.object({
  name: z.string().max(120).optional(),
  role: z.enum(["title", "subtitle", "badge", "decor"]).optional(),
  visible: z.boolean().optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  stroke: z.string().max(80).regex(/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|transparent)$/i).optional(),
  strokeWidth: z.number().min(0).max(1024).optional(),
  shadow: z.object({ color: z.string().max(80).regex(/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\)|transparent)$/i), blur: z.number().min(0).max(300), offsetX: z.number().min(-300).max(300), offsetY: z.number().min(-300).max(300) }).strict().nullable().optional(),
  gradient: PosterPaintGradientSchema.nullable().optional(),
  fontFamily: z.string().min(1).max(100).regex(/^[\w\s\-\u3400-\u9fff]+$/).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  underline: z.boolean().optional(),
  lineHeight: z.number().min(0.5).max(3).optional(),
  charSpacing: z.number().min(-300).max(1000).optional(),
  badge: z.object({ background: z.string().regex(/^#[0-9a-f]{6}$/i), padX: z.number().min(0).max(3), padY: z.number().min(0).max(3), radius: z.number().min(0).max(1) }).strict().nullable().optional(),
  radius: z.number().min(0).max(4096).optional(),
  resourceId: z.string().min(1).max(160).regex(/^[\w-]+$/).optional(),
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0.01).max(1), height: z.number().min(0.01).max(1) }).strict().refine(crop => crop.x + crop.width <= 1 && crop.y + crop.height <= 1).nullable().optional(),
  path: z.string().min(1).max(100000).regex(/^[MmLlHhVvCcSsQqTtAaZz\d\s,.eE+\-]+$/).optional(),
  text: z.string().max(8000).optional(),
  fill: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  fontSize: z.number().finite().min(4).max(8192).optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  x: z.number().finite().min(-8192).max(8192).optional(),
  y: z.number().finite().min(-8192).max(8192).optional(),
  width: z.number().finite().min(1).max(8192).optional(),
  height: z.number().finite().min(1).max(8192).optional(),
  rotation: z.number().finite().min(-360).max(360).optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
}).strict().refine(value => Object.keys(value).length > 0);
const patch = posterPatchSchema;
const typographyKeys = ["text", "fontSize", "fontFamily", "fontWeight", "fontStyle", "underline", "textAlign", "lineHeight", "charSpacing", "badge"];
function fail(message: string): never { throw new AppError("invalid_params", message, 400); }
const ids = z.array(z.string().min(1)).min(1).max(100).refine(ids => new Set(ids).size === ids.length);
const operation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), element: z.union([PosterElementSchema.options[0].strict(), PosterElementSchema.options[1].strict(), PosterElementSchema.options[2].strict(), PosterElementSchema.options[3].strict()]) }).strict(),
  z.object({ op: z.literal("remove"), ids }).strict(),
  z.object({ op: z.literal("duplicate"), ids, dx: z.number().min(-8192).max(8192).default(24), dy: z.number().min(-8192).max(8192).default(24) }).strict(),
  z.object({ op: z.literal("reorder"), ids, position: z.enum(["front", "back", "forward", "backward"]) }).strict(),
  z.object({ op: z.literal("group"), ids }).strict(),
  z.object({ op: z.literal("ungroup"), ids }).strict(),
  z.object({ op: z.literal("align"), ids, alignment: z.enum(["left", "center", "right", "top", "middle", "bottom"]) }).strict(),
  z.object({ op: z.literal("lock"), ids, locked: z.boolean() }).strict(),
  z.object({ op: z.literal("apply_template"), template: z.enum(POSTER_TEMPLATES), heading: z.string().min(1).max(80).optional(), subtitle: z.string().max(240).optional() }).strict(),
]);

const request = z.object({
  memoId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
  dryRun: z.boolean().optional(),
  background: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  backgroundGradient: PosterGradientSchema.nullable().optional(),
  canvas: z.object({ width: z.number().int().min(320).max(4096), height: z.number().int().min(320).max(4096), scaleElements: z.boolean().default(true) }).strict().optional(),
  platform: z.string().min(1).max(80).optional(),
  operations: z.array(operation).min(1).max(100).optional(),
  edits: z.array(z.object({ id: z.string().min(1), patch }).strict()).max(100).optional(),
}).strict().refine(value => Boolean(value.edits?.length || value.background || value.backgroundGradient !== undefined || value.canvas || value.platform || value.operations?.length));

export function applyPosterEdits(input: unknown, current: PosterDocument) {
  const parsed = request.safeParse(input);
  if (!parsed.success) fail("Invalid poster edits. Read get_poster_capabilities for supported fields and operations.");
  const args = parsed.data;
  if (args.canvas && args.platform) fail("Choose canvas or platform, not both.");
  const document = structuredClone(PosterDocumentSchema.parse(current));
  const selected = (wanted: string[], allowLocked = false) => wanted.map(id => {
    const element = document.elements.find(element => element.id === id);
    if (!element || (element.locked && !allowLocked)) return fail("Poster element is missing or locked");
    return element;
  });
  const edits = args.edits ?? [];
  if (new Set(edits.map(edit => edit.id)).size !== edits.length) fail("Duplicate poster element IDs");
  for (const edit of edits) {
    const [element] = selected([edit.id]);
    if (element.type !== "text" && typographyKeys.some(key => key in edit.patch)) fail("Typography edits require a text element");
    if (element.type === "image" && (edit.patch.fill !== undefined || edit.patch.gradient !== undefined)) fail("Image elements do not have a fill");
    if (element.type !== "image" && (edit.patch.resourceId !== undefined || edit.patch.crop !== undefined)) fail("Image edits require an image element");
    if (element.type !== "rect" && element.type !== "ellipse" && edit.patch.radius !== undefined) fail("Radius edits require a shape");
    if (element.type !== "path" && edit.patch.path !== undefined) fail("Path edits require a path element");
    const changes = { ...edit.patch } as Record<string, unknown>;
    for (const key of ["shadow", "gradient", "crop", "badge"]) if (changes[key] === null) changes[key] = undefined;
    Object.assign(element, changes, edit.patch.text !== undefined ? { sourceText: edit.patch.text } : {});
  }
  for (const op of args.operations ?? []) {
    if (op.op === "add") {
      if (document.elements.some(element => element.id === op.element.id)) fail("Duplicate poster element ID");
      if (op.element.type === "image" && op.element.crop && (op.element.crop.x + op.element.crop.width > 1 || op.element.crop.y + op.element.crop.height > 1)) fail("Image crop exceeds the image");
      document.elements.push(structuredClone(op.element));
      continue;
    }
    if (op.op === "apply_template") {
      if (document.elements.some(element => element.locked)) fail("Cannot replace a template with locked elements");
      const titleElement = document.elements.find(element => element.type === "text" && (element.role === "title" || element.id === "heading"));
      const title = op.heading ?? document.copy?.title ?? (titleElement?.type === "text" ? titleElement.sourceText ?? titleElement.text : "Poster");
      const subtitleElement = document.elements.find(element => element.type === "text" && (element.role === "subtitle" || element.id === "subtitle"));
      const subtitle = op.subtitle ?? document.copy?.subtitle ?? (subtitleElement?.type === "text" ? subtitleElement.sourceText ?? subtitleElement.text : "");
      const built = compilePosterMemo({ notebookId: "template", title: "Poster", heading: title, subtitle, template: op.template });
      const resized = resizePosterDocument(built.document, document.width, document.height);
      Object.assign(document, { elements: resized.elements, copy: resized.copy, templateId: op.template, background: resized.background, backgroundGradient: undefined });
      continue;
    }
    const elements = selected(op.ids, op.op === "lock");
    if (op.op === "lock") { elements.forEach(element => { element.locked = op.locked; }); continue; }
    if (op.op === "remove") document.elements = document.elements.filter(element => !op.ids.includes(element.id));
    if (op.op === "duplicate") {
      const groups = new Map<string, string>();
      document.elements.push(...elements.map(element => {
        if (element.groupId && !groups.has(element.groupId)) groups.set(element.groupId, crypto.randomUUID());
        return { ...structuredClone(element), id: crypto.randomUUID(), x: element.x + op.dx, y: element.y + op.dy, groupId: element.groupId ? groups.get(element.groupId) : undefined };
      }));
    }
    if (op.op === "group") {
      const groupId = crypto.randomUUID();
      elements.forEach(element => { element.groupId = groupId; });
    }
    if (op.op === "ungroup") elements.forEach(element => { element.groupId = undefined; });
    if (op.op === "align") {
      if (elements.some(element => element.rotation !== 0)) fail("Align requires unrotated elements; set rotation=0 first");
      for (const element of elements) {
        if (op.alignment === "left") element.x = 0;
        if (op.alignment === "center") element.x = (document.width - element.width) / 2;
        if (op.alignment === "right") element.x = document.width - element.width;
        if (op.alignment === "top") element.y = 0;
        if (op.alignment === "middle") element.y = (document.height - element.height) / 2;
        if (op.alignment === "bottom") element.y = document.height - element.height;
      }
    }
    if (op.op === "reorder") {
      const picked = document.elements.filter(element => op.ids.includes(element.id));
      const rest = document.elements.filter(element => !op.ids.includes(element.id));
      if (op.position === "front") document.elements = [...rest, ...picked];
      else if (op.position === "back") document.elements = [...picked, ...rest];
      else {
        const direction = op.position === "forward" ? 1 : -1;
        const order = direction === 1 ? [...document.elements].reverse() : [...document.elements];
        for (const element of order.filter(element => op.ids.includes(element.id))) {
          const index = document.elements.indexOf(element), target = index + direction;
          if (target >= 0 && target < document.elements.length && !op.ids.includes(document.elements[target].id)) {
            [document.elements[index], document.elements[target]] = [document.elements[target], document.elements[index]];
          }
        }
      }
    }
  }
  const platform = args.platform ? PLATFORMS.find(platform => platform.id === args.platform) : undefined;
  if (args.platform && !platform) fail("Unknown platform. Read get_poster_capabilities.");
  const size = args.canvas ?? (platform ? { width: platform.width, height: platform.height, scaleElements: true } : undefined);
  if (size && (size.width !== document.width || size.height !== document.height)) {
    if (document.elements.some(element => element.locked) && size.scaleElements) fail("Cannot scale locked elements");
    Object.assign(document, size.scaleElements ? resizePosterDocument(document, size.width, size.height) : { width: size.width, height: size.height });
    document.platformId = platform?.id;
  }
  if (platform) document.platformId = platform.id;
  if (args.background !== undefined) document.background = args.background;
  if (args.backgroundGradient !== undefined) document.backgroundGradient = args.backgroundGradient ?? undefined;
  const copyTouched = edits.some(edit => "text" in edit.patch || "role" in edit.patch) || args.operations?.some(op => ["remove", "add", "apply_template"].includes(op.op));
  if (copyTouched) {
    document.copy = { title: "", subtitle: "", badge: "" };
    for (const role of ["title", "subtitle", "badge"] as const) {
      document.copy[role] = [...new Set(document.elements.filter(element => element.type === "text" && (element.role === role || (role === "title" && element.id === "heading") || (role === "subtitle" && element.id === "subtitle")))
        .map(element => element.type === "text" ? element.sourceText ?? element.text : ""))].join("\n");
    }
  }
  const safe = PosterDocumentSchema.safeParse(document);
  if (!safe.success) fail("Poster edits exceed document limits");
  const changed = JSON.stringify(safe.data) !== JSON.stringify(PosterDocumentSchema.parse(current));
  if (changed) safe.data.previewResourceId = undefined;
  return { document: safe.data, changed };
}

export function posterCapabilities() {
  return {
    templates: POSTER_TEMPLATES.map(id => ({ id, sourceBuilder: "server", imageRenderer: "client" })),
    browserDesignTemplates: POSTER_DESIGN_TEMPLATES.filter(template => template.available).map(template => ({ ...template, renderer: "browser", instruction: "Use request_poster_render with templateId and expectedRevision. This ID is not a server apply_template ID." })),
    contentLayouts: { layouts: ["auto", "grid", "list"], sections: { min: 2, max: 6, headingMaxLength: 32, bodyMaxLength: 120 }, instruction: "For explanatory posters, plan 3–6 concise sections before creating. Use grid for categories/comparison, list for steps/ranked points. badge and footer are optional. Auto adapts columns to the aspect ratio. Headline-only posters may omit sections." },
    formats: POSTER_FORMATS,
    platforms: PLATFORMS,
    fonts: POSTER_FONTS.map(({ family, zh, en }) => ({ family, zh, en })),
    operations: ["add", "remove", "duplicate", "reorder", "group", "ungroup", "align", "lock", "apply_template"],
    editableFields: Object.keys(patch.shape),
    limits: { maxElements: 500, maxOperations: 100, canvasMin: 320, canvasMax: 4096 },
    rendering: { image: "browser", preview: "client_render_queue", export: ["source", "saved_preview"], instruction: "Request fresh PNG rendering or full design templates with request_poster_render. An online desktop/Web workspace handles the job; no poster editor mount is needed. Query get_poster_render_job, then get_poster_preview. Never call a pending or failed job rendered." },
    instruction: "Read get_poster before editing. Edits run first, then operations in order, then canvas/platform resize. Array order is back to front. Unlock in an earlier call before field edits; ordered operations can explicitly unlock before a later operation. apply_template replaces all elements; use only when requested. Image resource IDs must belong to this poster. dryRun does not save changes.",
  };
}
