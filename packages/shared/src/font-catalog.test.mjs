import { expect, test } from "bun:test";
import { FONT_CATALOG, FONT_IDS, findCatalogFont } from "./font-catalog";
import { NOTE_IMAGE_REMOTE_FONTS } from "./note-image-remote-fonts";
import { NOTE_IMAGE_FONT_FAMILIES } from "./note-image-card";
import { NoteBodyFontUpdateSchema } from "./schemas";
import { parsePublishedNoteBodyFont } from "./sharing";
import { POSTER_FONTS } from "./poster-fonts";
import { createPosterDocument, parsePosterDocument, serializePosterDocument } from "./poster";

test("all 23 catalog fonts are available to sharing, body settings and posters without duplicate poster families", () => {
  expect(FONT_IDS).toHaveLength(23);
  expect(POSTER_FONTS.map(font => font.family)).toEqual(FONT_IDS.map(id => FONT_CATALOG[id].posterFamily));
  expect(NOTE_IMAGE_REMOTE_FONTS).toBe(FONT_CATALOG);
  expect(new Set(POSTER_FONTS.map(font => font.family)).size).toBe(POSTER_FONTS.length);
  for (const id of FONT_IDS) {
    const font = FONT_CATALOG[id];
    expect(NOTE_IMAGE_FONT_FAMILIES[id]).toContain(font.family);
    expect(NoteBodyFontUpdateSchema.parse({ bodyFont: id }).bodyFont).toBe(id);
    expect(parsePublishedNoteBodyFont(id)).toBe(id);
    expect(POSTER_FONTS.filter(entry => entry.family === font.posterFamily)).toHaveLength(1);
    expect(findCatalogFont(font.posterFamily)).toBe(id);
    expect(findCatalogFont(font.family)).toBe(id);
    const document = createPosterDocument("字体目录");
    const text = document.elements.find(element => element.type === "text");
    text.fontFamily = font.posterFamily;
    expect(parsePosterDocument(serializePosterDocument(document))).toEqual(document);
  }
  expect(NoteBodyFontUpdateSchema.safeParse({ bodyFont: "unknown-font" }).success).toBe(false);
});

test("poster downloads reuse pinned assets and retain their integrity and license metadata", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const { remoteFontCssUrl, remoteFontUrls } = await import("./font-catalog");
  const { POSTER_FONT_NOTICES } = await import("./poster-font-notices");
  const { resolveNoteImagePreferences } = await import("./note-image-preferences");
  for (const id of FONT_IDS) {
    expect(resolveNoteImagePreferences({ fontStyle: id }).fontStyle).toBe(id);
    const font = FONT_CATALOG[id];
    if (!font.path.startsWith("gh/")) continue;
    const name = font.path.split("/").at(-1);
    const bytes = await readFile(new URL(`../../../apps/web/public/poster-fonts/${name}`, import.meta.url));
    expect(bytes.byteLength).toBe(font.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(font.sha256);
    const urls = remoteFontUrls(remoteFontCssUrl(id));
    expect(urls).toHaveLength(2);
    expect(urls[1]).toStartWith("https://raw.githubusercontent.com/tianma-if/edgeever/");
    expect(urls[1]).toContain("/0da78f6ce8a4643b2dfb7afe9f7a5101472c4ffb/");
    expect(POSTER_FONT_NOTICES[id]).toContain("Copyright");
  }
  expect(() => remoteFontUrls("https://cdn.jsdelivr.net/gh/untrusted/repo@main/font.ttf")).toThrow();
});
