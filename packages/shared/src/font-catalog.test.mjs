import { expect, test } from "bun:test";
import { FONT_CATALOG, FONT_IDS, findCatalogFont } from "./font-catalog";
import { NOTE_IMAGE_REMOTE_FONTS } from "./note-image-remote-fonts";
import { NOTE_IMAGE_FONT_FAMILIES } from "./note-image-card";
import { NoteBodyFontUpdateSchema } from "./schemas";
import { parsePublishedNoteBodyFont } from "./sharing";
import { POSTER_FONTS } from "./poster-fonts";
import { createPosterDocument, parsePosterDocument, serializePosterDocument } from "./poster";

test("all eight catalog fonts are available to sharing, body settings and posters without duplicate poster families", () => {
  expect(FONT_IDS).toHaveLength(8);
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
