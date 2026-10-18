import { FONT_CATALOG, FONT_IDS } from "./font-catalog";

/** All named choices come from the same catalog as body and share-image typography. */
export const POSTER_FONTS = FONT_IDS.map(id => ({
  family: FONT_CATALOG[id].posterFamily,
  zh: FONT_CATALOG[id].zh,
  en: FONT_CATALOG[id].en,
}));
