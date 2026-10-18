import { FONT_CATALOG, findCatalogFont } from "@edgeever/shared/font-catalog";
import { loadCatalogFont } from "@edgeever/shared/font-loader";
import { cache } from "fabric";
import { POSTER_FONTS } from "@edgeever/shared";
export { POSTER_FONTS };
export async function loadPosterFont(family: string, text = "") {
  const id = findCatalogFont(family);
  if (!id) return;
  await loadCatalogFont(id, text || `${FONT_CATALOG[id].zh} ${FONT_CATALOG[id].en}`, { family });
  cache.clearFontCache(family);
}
export const loadDesignFonts = (families: string[], text: string) =>
  Promise.all([...new Set(families)].map(family => loadPosterFont(family, text)));
