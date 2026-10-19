import { FONT_CATALOG, findCatalogFont } from "@edgeever/shared/font-catalog";
import { loadCatalogFont, loadOfflineFonts, withFontDeadline } from "@edgeever/shared/font-loader";
import { cache } from "fabric";
import { POSTER_FONTS } from "@edgeever/shared";
export { POSTER_FONTS };
export async function loadPosterFont(family: string, text = "", { deadline = true }: { deadline?: boolean } = {}) {
  await loadOfflineFonts(text || "EdgeEver 中文");
  const registrationFamily = family.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const id = findCatalogFont(registrationFamily);
  if (!id) return;
  const pending = loadCatalogFont(id, text || `${FONT_CATALOG[id].zh} ${FONT_CATALOG[id].en}`, { family: registrationFamily });
  await (deadline ? withFontDeadline(pending) : pending);
  cache.clearFontCache(family);
  // Fabric keys glyph metrics by the complete runtime fallback stack.
  cache.clearFontCache(`${registrationFamily}, "EdgeEver Offline Sans", sans-serif`);
}
export const loadDesignFonts = (families: string[], text: string) =>
  Promise.all([...new Set(families)].map(family => loadPosterFont(family, text).catch(() => { /* Templates still render with the offline default. */ })));
