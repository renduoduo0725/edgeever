import { FONT_CATALOG, findCatalogFont } from "@edgeever/shared/font-catalog";
import { loadCatalogFont } from "@edgeever/shared/font-loader";
import { cache } from "fabric";
import { POSTER_FONTS } from "@edgeever/shared";
export { POSTER_FONTS };
const loads = new Map<string, Promise<void>>();
export async function loadPosterFont(family: string, text = "") {
  const id = findCatalogFont(family);
  if (id) {
    await loadCatalogFont(id, text || `${FONT_CATALOG[id].zh} ${FONT_CATALOG[id].en}`, { family });
    cache.clearFontCache(family);
    return;
  }
  const font = POSTER_FONTS.find((entry) => entry.family === family);
  if (!font) return Promise.resolve();
  if (!loads.has(family)) {
    const face = new FontFace(
      family,
      `url("/poster-fonts/${font.file}.${font.file === "douyin" ? "ttf" : "woff2"}")`,
    );
    const promise = face
      .load()
      .then((loaded) => {
        window.document.fonts.add(loaded);
        cache.clearFontCache(family);
      })
      .catch((error) => {
        loads.delete(family);
        throw error;
      });
    loads.set(family, promise);
  }
  return loads.get(family)!;
}
export const loadDesignFonts = (families: string[], text: string) =>
  Promise.all([...new Set(families)].map(family => loadPosterFont(family, text)));
