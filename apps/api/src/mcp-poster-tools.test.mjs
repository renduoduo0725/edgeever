import { expect, test } from "bun:test";
import { createPosterDocument, POSTER_FORMATS, POSTER_TEMPLATES, parsePosterDocument, serializePosterDocument } from "@edgeever/shared";
import { applyPosterEdits, compilePosterMemo, posterCapabilities } from "./mcp-poster-tools";

test("detailed poster edits preserve unaffected elements and clear optional styles", () => {
  const poster = { ...createPosterDocument("Original"), previewResourceId: "preview" };
  const heading = poster.elements.find(element => element.type === "text");
  const input = { memoId: "memo", expectedRevision: 1, edits: [{ id: heading.id, patch: { fontFamily: "思源黑体", fontStyle: "italic", underline: true, lineHeight: 1.6, charSpacing: 40, stroke: "#16A06E", strokeWidth: 2, shadow: { color: "#07130B", blur: 8, offsetX: 2, offsetY: 3 }, visible: false } }] };
  const result = applyPosterEdits(input, poster);
  expect(result.document.elements.find(element => element.id === heading.id)).toMatchObject(input.edits[0].patch);
  expect(result.document.elements.filter(element => element.id !== heading.id)).toEqual(poster.elements.filter(element => element.id !== heading.id));
  expect(result.document.previewResourceId).toBeUndefined();
  const cleared = applyPosterEdits({ memoId: "memo", expectedRevision: 2, edits: [{ id: heading.id, patch: { shadow: null } }] }, result.document);
  expect(cleared.document.elements.find(element => element.id === heading.id).shadow).toBeUndefined();
  expect(poster.elements.find(element => element.id === heading.id).shadow).toBeUndefined();
});

test("poster operations add, group, duplicate, reorder, align and remove transactionally", () => {
  const poster = createPosterDocument("Original");
  const operations = [
    { op: "add", element: { id: "shape", name: "Shape", type: "rect", x: 20, y: 20, width: 100, height: 80, fill: "#16A06E" } },
    { op: "group", ids: ["heading", "shape"] },
    { op: "duplicate", ids: ["heading", "shape"], dx: 30, dy: 40 },
    { op: "reorder", ids: ["shape"], position: "back" },
    { op: "align", ids: ["shape"], alignment: "center" },
    { op: "remove", ids: ["subtitle"] },
  ];
  const result = applyPosterEdits({ memoId: "memo", expectedRevision: 1, operations }, poster);
  expect(result.document.elements).toHaveLength(5);
  expect(result.document.elements[0]).toMatchObject({ id: "shape", x: 490 });
  const grouped = result.document.elements.filter(element => element.groupId);
  expect(grouped).toHaveLength(4);
  expect(new Set(grouped.map(element => element.groupId)).size).toBe(2);
  expect(poster.elements).toHaveLength(3);
  expect(() => applyPosterEdits({ memoId: "memo", expectedRevision: 1, operations: [...operations, { op: "remove", ids: ["missing"] }] }, poster)).toThrow();
  expect(poster.elements).toHaveLength(3);
});

test("locked objects, invalid types, bad crops and limits cannot be bypassed", () => {
  const poster = createPosterDocument("Original");
  poster.elements[1].locked = true;
  const run = fields => applyPosterEdits({ memoId: "memo", expectedRevision: 1, ...fields }, poster);
  expect(() => run({ operations: [{ op: "remove", ids: ["heading"] }] })).toThrow("locked");
  expect(() => run({ canvas: { width: 800, height: 800 } })).toThrow("locked");
  expect(() => run({ operations: [{ op: "apply_template", template: "bold" }] })).toThrow("locked");
  expect(() => run({ edits: [{ id: "accent", patch: { fontFamily: "Inter" } }] })).toThrow("Typography");
  expect(() => run({ edits: [{ id: "accent", patch: { resourceId: "foreign" } }] })).toThrow("Image edits");
  expect(() => run({ operations: [{ op: "add", element: { id: "accent", name: "Duplicate", type: "rect", x: 0, y: 0, width: 10, height: 10, fill: "#07130B" } }] })).toThrow("Duplicate");
  expect(() => run({ operations: [{ op: "add", element: { id: "img", name: "Image", type: "image", resourceId: "res", x: 0, y: 0, width: 10, height: 10, crop: { x: 0.8, y: 0, width: 0.4, height: 1 } } }] })).toThrow("crop");
  const unlocked = run({ operations: [{ op: "lock", ids: ["heading"], locked: false }] });
  expect(unlocked.document.elements[1].locked).toBe(false);
  expect(() => applyPosterEdits({ memoId: "memo", expectedRevision: 2, operations: [{ op: "add", element: { id: "extra", name: "Extra", type: "rect", x: 0, y: 0, width: 10, height: 10, fill: "#07130B" } }] }, { ...poster, elements: Array.from({ length: 500 }, (_, i) => ({ ...poster.elements[0], id: `e_${i}` })) })).toThrow("limits");
});

test("canvas/platform changes scale existing geometry and template replacement is explicit", () => {
  const poster = createPosterDocument("Original", "Subtitle");
  const scaled = applyPosterEdits({ memoId: "memo", expectedRevision: 1, canvas: { width: 540, height: 720 } }, poster);
  expect(scaled.document.elements[0].width).toBe(poster.elements[0].width / 2);
  const fixed = applyPosterEdits({ memoId: "memo", expectedRevision: 1, canvas: { width: 540, height: 720, scaleElements: false } }, poster);
  expect(fixed.document.elements).toEqual(poster.elements);
  const platform = applyPosterEdits({ memoId: "memo", expectedRevision: 1, platform: "youtube" }, poster);
  expect(platform.document).toMatchObject({ width: 1280, height: 720, platformId: "youtube" });
  expect(() => applyPosterEdits({ memoId: "memo", expectedRevision: 1, platform: "wrong" }, poster)).toThrow("Unknown platform");
  const template = applyPosterEdits({ memoId: "memo", expectedRevision: 1, operations: [{ op: "apply_template", template: "bold" }] }, poster);
  expect(template.document).toMatchObject({ templateId: "bold", background: "#07130b", copy: { title: "Original", subtitle: "Subtitle" } });
  const caps = posterCapabilities();
  expect(caps.fonts.some(font => font.family === "思源黑体")).toBe(true);
  expect(caps.operations).toContain("duplicate");
});

test("poster creation round-trips every template and format with long CJK copy", () => {
  for (const template of POSTER_TEMPLATES) for (const format of POSTER_FORMATS) {
    const { document } = compilePosterMemo({ notebookId: "inbox", title: "Poster", heading: "精力管理".repeat(20), subtitle: "保护精力".repeat(60), template, format: format.id });
    expect(parsePosterDocument(serializePosterDocument(document))).toEqual(document);
    const texts = document.elements.filter(element => element.type === "text");
    for (const text of texts) {
      const lines = text.text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(Array.from(line).length * text.fontSize / text.width)), 0);
      expect(lines * text.fontSize * text.lineHeight).toBeLessThanOrEqual(text.height);
      expect(text.y + text.height).toBeLessThanOrEqual(document.height);
    }
    expect(texts[0].y + texts[0].height).toBeLessThan(texts[1].y);
  }
  expect(() => compilePosterMemo({ notebookId: "inbox", title: "Poster", heading: "Title", subtitle: "保护精力\n".repeat(40), format: "wechat" })).toThrow("does not fit");
});

test("poster edits reject locked elements, duplicate IDs, unknown patch keys and invalid geometry", () => {
  const poster = createPosterDocument("Hello");
  const element = poster.elements.find(element => element.type === "text");
  const input = patch => ({ memoId: "memo", expectedRevision: 1, edits: [{ id: element.id, patch }] });
  expect(() => applyPosterEdits(input({ text: "Bad" }), { ...poster, elements: poster.elements.map(item => item.id === element.id ? { ...item, locked: true } : item) })).toThrow();
  expect(() => applyPosterEdits({ ...input({ text: "Bad" }), edits: [input({ text: "One" }).edits[0], input({ text: "Two" }).edits[0]] }, poster)).toThrow();
  expect(() => applyPosterEdits(input({ resourceId: "other" }), poster)).toThrow();
  expect(() => applyPosterEdits(input({ width: -1 }), poster)).toThrow();
  expect(() => applyPosterEdits({ memoId: "memo", expectedRevision: 1 }, poster)).toThrow();
});

test("poster edits update canonical copy, support background changes and retain a preview on no-op", () => {
  const poster = { ...createPosterDocument("Hello"), previewResourceId: "preview" };
  const title = poster.elements.find(element => element.type === "text");
  const changed = applyPosterEdits({ memoId: "memo", expectedRevision: 1, background: "#16A06E", edits: [{ id: title.id, patch: { text: "New heading" } }] }, poster);
  expect(changed.document.background).toBe("#16A06E");
  expect(changed.document.elements.find(element => element.id === title.id).sourceText).toBe("New heading");
  expect(changed.document.previewResourceId).toBeUndefined();
  const unchanged = applyPosterEdits({ memoId: "memo", expectedRevision: 1, background: poster.background }, poster);
  expect(unchanged.changed).toBe(false);
  expect(unchanged.document.previewResourceId).toBe("preview");
});

test("informative posters retain each section through editing and source round-trip", () => {
  const sections = [
    { heading: "社交", body: "连接用户与日常沟通场景" },
    { heading: "内容", body: "承载资讯、视频与数字阅读" },
    { heading: "游戏", body: "连接互动娱乐与数字内容" },
    { heading: "金融科技", body: "服务支付与金融应用场景" },
    { heading: "企业服务", body: "提供云与企业协作能力" },
  ];
  for (const format of POSTER_FORMATS) {
    const { document } = compilePosterMemo({ notebookId: "inbox", title: "腾讯产业布局", heading: "腾讯产业布局", subtitle: "以连接为核心的数字生态", badge: "产业观察", footer: "从用户连接，延伸到内容与服务", sections, template: "bold", format: format.id });
    const restored = parsePosterDocument(serializePosterDocument(document));
    expect(restored).toEqual(document);
    for (const element of document.elements) {
      expect(element.x).toBeGreaterThanOrEqual(0);
      expect(element.y).toBeGreaterThanOrEqual(0);
      expect(element.x + element.width).toBeLessThanOrEqual(document.width + 0.001);
      expect(element.y + element.height).toBeLessThanOrEqual(document.height + 0.001);
    }
    sections.forEach((section, index) => {
      expect(document.elements.find(e => e.id === `section-${index + 1}-body`).text).toBe(section.body);
    });
    const edited = applyPosterEdits({ memoId: "memo", expectedRevision: 1, edits: [{ id: "section-1-body", patch: { text: "连接人与沟通场景" } }] }, document).document;
    expect(edited.elements.find(e => e.id === "section-1-body").text).toBe("连接人与沟通场景");
    expect(edited.copy.title).toBe("腾讯产业布局");
    expect(edited.copy.subtitle).toBe("以连接为核心的数字生态");
  }
});

test("content layouts adapt columns, reject overflow and leave headline-only callers compatible", () => {
  const sections = Array.from({ length: 6 }, (_, i) => ({ heading: `要点 ${i + 1}`, body: "简短说明" }));
  const build = fields => compilePosterMemo({ notebookId: "inbox", title: "Poster", heading: "知识要点", sections, ...fields }).document;
  const grid = build({ layout: "grid" });
  const list = build({ layout: "list" });
  expect(grid.elements.find(e => e.id === "section-2-card").y).toBe(grid.elements.find(e => e.id === "section-1-card").y);
  expect(list.elements.find(e => e.id === "section-2-card").y).toBeGreaterThan(list.elements.find(e => e.id === "section-1-card").y);
  expect(build({ format: "story" }).elements.find(e => e.id === "section-2-card").x).toBe(build({ format: "story" }).elements.find(e => e.id === "section-1-card").x);
  expect(() => build({ format: "wechat", layout: "list", sections: sections.map(section => ({ ...section, body: "说明\n".repeat(30) })) })).toThrow("does not fit");
  expect(() => build({ sections: [sections[0]] })).toThrow();
  expect(() => build({ sections: sections.concat(sections[0]) })).toThrow();
  const legacy = compilePosterMemo({ notebookId: "inbox", title: "Poster", heading: "一句话" }).document;
  expect(legacy.elements).toHaveLength(3);
  expect(() => build({ sections: undefined, footer: "Requires sections" })).toThrow("require sections");
});
