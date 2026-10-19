import { pinnedFontIntegrity } from "./font-resources";
import { FONT_CATALOG, FONT_IDS, type RemoteNoteImageFont } from "./font-catalog-data";
export * from "./font-catalog-data";

const CDN_ROOTS = ["https://cdn.jsdelivr.net/npm/", "https://unpkg.com/"];

export type RemoteFontSubset = { asset: string; family: string; range: string; weight: string };

/** Parse only font descriptors, never insert third-party styles into the document. */
export const parseRemoteFontCss = (css: string, font: RemoteNoteImageFont): RemoteFontSubset[] => {
  const { path, family } = FONT_CATALOG[font];
  const base = new URL(path, CDN_ROOTS[0]);
  const directory = base.href.slice(0, base.href.lastIndexOf("/") + 1);
  const blocks: RemoteFontSubset[] = [];
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const body = match[1];
    const file = /url\(\s*["']?([^\s"')]+\.woff2)["']?\s*\)/i.exec(body)?.[1];
    const range = /unicode-range\s*:\s*([^;]+)/i.exec(body)?.[1].trim();
    const weight = /font-weight\s*:\s*(\d+(?:\s+\d+)?)/i.exec(body)?.[1];
    if (!file || !range || !weight || !/^U\+[\da-f?]+(?:-[\da-f]+)?(?:\s*,\s*U\+[\da-f?]+(?:-[\da-f]+)?)*$/i.test(range)) continue;
    const url = new URL(file, base);
    // A pinned manifest may only reference WOFF2 files inside its own package directory.
    if (!url.href.startsWith(directory) || url.search || url.hash) continue;
    blocks.push({ asset: url.href, family, range, weight });
  }
  if (!blocks.length) throw new Error("NOTE_IMAGE_FONT_UNAVAILABLE");
  return blocks;
};

/** Mirror paths are equivalent, so both hosts share a single persistent cache key. */
export const remoteFontUrls = (url: string) => {
  if (url.startsWith("https://cdn.jsdelivr.net/gh/")) {
    // Only the pinned files listed in our catalog may use the repository mirror.
    if (!pinnedFontIntegrity(url) && !FONT_IDS.some(id => remoteFontCssUrl(id) === url)) throw new Error("NOTE_IMAGE_FONT_UNAVAILABLE");
    return [url, url.replace("https://cdn.jsdelivr.net/gh/", "https://raw.githubusercontent.com/").replace("@", "/")];
  }
  if (!url.startsWith(CDN_ROOTS[0])) throw new Error("NOTE_IMAGE_FONT_UNAVAILABLE");
  return CDN_ROOTS.map(root => root + url.slice(CDN_ROOTS[0].length));
};

export const remoteFontCssUrl = (font: RemoteNoteImageFont) => {
  const path = FONT_CATALOG[font].path;
  return path.startsWith("gh/") ? `https://cdn.jsdelivr.net/${path}` : CDN_ROOTS[0] + path;
};

export const remoteOriginalFont = (font: RemoteNoteImageFont): RemoteFontSubset | undefined => {
  const entry = FONT_CATALOG[font];
  return "weight" in entry
    ? { asset: remoteFontCssUrl(font), family: entry.family, weight: entry.weight, range: "U+0-10FFFF" }
    : undefined;
};

export const remoteFontIntegrity = (url: string) => pinnedFontIntegrity(url) ?? FONT_IDS.map(id => ({ ...FONT_CATALOG[id], url: remoteFontCssUrl(id) })).find(entry => "bytes" in entry && entry.url === url);
