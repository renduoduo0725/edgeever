import { POSTER_FONT_NOTICES } from "./poster-font-notices";
import { readFontCache, writeFontCache } from "./note-image-font-cache";
import { FONT_CATALOG, parseRemoteFontCss, remoteFontCssUrl, remoteFontUrls, remoteOriginalFont, remoteFontIntegrity, type RemoteNoteImageFont } from "./font-catalog";
import { OFFLINE_MONO_NOTICE } from "./offline-font-notices";
import { NOTE_IMAGE_REMOTE_FONT_NOTICES } from "./note-image-remote-font-notices";

import { OFFLINE_SANS_FAMILY, OFFLINE_SANS_URL, OFFLINE_MONO_FAMILY, OFFLINE_MONO_URL, LEGACY_BODY_FONTS, pinnedFontUrl } from "./font-resources";
import type { RemoteFontSubset } from "./font-catalog";

import { bundledResources } from "./font-assets-registry";
export { configureBundledFontAssets, type FontAssetUrl } from "./font-assets-registry";

const validRemoteResource = async (data: ArrayBuffer, css: boolean, url: string) => {
  if (data.byteLength <= (css ? 0 : 48) || data.byteLength > (css ? 1_000_000 : 24_000_000)) return false;
  const signature = css ? 0 : new DataView(data).getUint32(0);
  const valid = css ? new TextDecoder().decode(data).includes("@font-face")
    : signature === 0x774f4632 ? new DataView(data).getUint32(8) === data.byteLength
    : signature === 0x00010000 || signature === 0x4f54544f;
  if (!valid) return false;
  const original = remoteFontIntegrity(url);
  if (original && "bytes" in original) {
    if (data.byteLength !== original.bytes) return false;
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("") === original.sha256;
    }
  }
  return true;
};

/** Rendering can use local defaults while an optional download finishes into the cache. */
export const withFontDeadline = <T>(pending: Promise<T>, milliseconds = 3_000): Promise<T> => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("NOTE_IMAGE_FONT_UNAVAILABLE")), milliseconds);
  pending.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});

// A wall-clock deadline also covers WebViews that fail to dispatch XHR timeout events.
const requestResource = (url: string, local = false) => new Promise<ArrayBuffer>((resolve, reject) => {
  const request = new XMLHttpRequest();
  const fail = () => { clearTimeout(timer); reject(new Error("NOTE_IMAGE_FONT_UNAVAILABLE")); };
  const timer = setTimeout(() => { fail(); request.abort(); }, local ? 1_500 : 15_000);
  request.open("GET", url);
  request.responseType = "arraybuffer";
  request.timeout = local ? 1_500 : 15_000;
  request.onload = () => {
    clearTimeout(timer);
    if ((request.status === 200 || local && request.status === 0) && request.response instanceof ArrayBuffer) resolve(request.response);
    else fail();
  };
  request.onerror = request.ontimeout = request.onabort = fail;
  try { request.send(); } catch { fail(); }
});

/** Cache manifests as well as subsets, so a later export works without the network. */
export const createRemoteFontResourceLoader = () => {
  const remoteResources = new Map<string, Promise<ArrayBuffer>>();
  return (url: string, css = false): Promise<ArrayBuffer> => {
    let pending = remoteResources.get(url);
    if (!pending) {
      pending = (async () => {
        const local = bundledResources.get(url);
        if (local) {
          try {
            const data = await requestResource(local, true);
            if (await validRemoteResource(data, css, url)) return data;
          } catch { /* The OS font stack remains available if local assets are damaged. */ }
        }
        const cached = await readFontCache(url);
        if (cached && await validRemoteResource(cached, css, url)) return cached;
        // Cached fonts remain usable offline; uncached fonts fail without waiting for mirrors.
        if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("NOTE_IMAGE_FONT_UNAVAILABLE");
        for (const mirror of remoteFontUrls(url)) {
          try {
            const data = await requestResource(mirror);
            if (!await validRemoteResource(data, css, url)) continue;
            await writeFontCache(url, data);
            return data;
          } catch { /* Try the next pinned source. Never send note text in requests. */ }
        }
        throw new Error("NOTE_IMAGE_FONT_UNAVAILABLE");
      })();
      remoteResources.set(url, pending);
      void pending.catch(() => remoteResources.delete(url));
    }
    return pending;
  };
};
export const loadRemoteFontResource = createRemoteFontResourceLoader();

const remoteDataUrl = async (url: string) => {
  const data = await loadRemoteFontResource(url);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("NOTE_IMAGE_FONT_UNAVAILABLE"));
    const signature = new DataView(data).getUint32(0);
    reader.readAsDataURL(new Blob([data], { type: signature === 0x00010000 ? "font/ttf" : signature === 0x4f54544f ? "font/otf" : "font/woff2" }));
  });
};

export const fontSubsetContains = (range: string, points: ReadonlySet<number>) => {
  const sorted = [...points].sort((a, b) => a - b);
  return range.split(",").some(part => {
    const [start, end = start] = part.trim().replace(/^U\+/i, "").split("-");
    const lower = parseInt(start.replace(/\?/g, "0"), 16);
    const upper = parseInt(end.replace(/\?/g, "F"), 16);
    let left = 0;
    let right = sorted.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (sorted[middle] < lower) left = middle + 1;
      else right = middle;
    }
    return left < sorted.length && sorted[left] <= upper;
  });
};


const faces = new Map<string, Promise<FontFace>>();
/** All three font pickers/renderers use this loader and the same persistent byte cache. */
export const loadCatalogFont = async (id: RemoteNoteImageFont, text: string, { embed = false, family = FONT_CATALOG[id].family }: { embed?: boolean; family?: string } = {}) => {
  const original = remoteOriginalFont(id);
  const catalog = original ? [original] : parseRemoteFontCss(new TextDecoder().decode(await loadRemoteFontResource(remoteFontCssUrl(id), true)), id);
  const css = await loadFontBlocks(catalog, text, { embed, family });
  if (!css) return "";
  const notices = POSTER_FONT_NOTICES[id] ?? (original
    ? `Original font loaded unchanged from ${original.asset}. Original copyright and licensing metadata are retained in the font container. Alibaba: https://fonts.alibabagroup.com/ ; YouShe: https://www.uisdc.com/ . No conversion or subsetting is performed.`
    : NOTE_IMAGE_REMOTE_FONT_NOTICES);
  return `/*! ${notices.replaceAll("*/", "* /")} */\n${css}`;
};

/** Templates, legacy body choices and the catalog use the same validated byte cache. */
export const loadFontBlocks = async (catalog: readonly RemoteFontSubset[], text: string, { embed = false, family }: { embed?: boolean; family?: string } = {}) => {
  const points = new Set(Array.from(text, char => char.codePointAt(0)!));
  const blocks = catalog.filter(block => fontSubsetContains(block.range, points));
  const css = await Promise.all(blocks.map(async block => {
    const resolvedFamily = family ?? block.family;
    const key = `${resolvedFamily}:${block.asset}`;
    let pending = faces.get(key);
    if (!pending) {
      pending = (async () => {
        const data = await loadRemoteFontResource(block.asset);
        const face = new FontFace(resolvedFamily, data, { weight: block.weight, unicodeRange: block.range });
        await withFontDeadline(face.load(), 5_000);
        document.fonts.add(face);
        return face;
      })();
      faces.set(key, pending);
      void pending.catch(() => faces.delete(key));
    }
    await pending;
    return embed ? `@font-face{font-family:"${resolvedFamily}";font-style:normal;font-weight:${block.weight};src:url("${await remoteDataUrl(block.asset)}");unicode-range:${block.range}}` : "";
  }));
  if (!embed || !blocks.length) return "";
  return css.join("\n");
};

/** Always prepare the same small offline fallback in every renderer. Each face may fail independently. */
export const loadOfflineFonts = async (text: string, embed = false) => {
  if (!bundledResources.size) return "";
  const results = await Promise.allSettled([
    loadFontBlocks([{ asset: OFFLINE_SANS_URL, family: OFFLINE_SANS_FAMILY, weight: "400", range: "U+0-10FFFF" }], text, { embed }),
    loadFontBlocks([{ asset: OFFLINE_MONO_URL, family: OFFLINE_MONO_FAMILY, weight: "100 900", range: "U+0-024F" }], text, { embed }),
  ]);
  const css = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []).filter(Boolean).join("\n");
  return css && embed ? `/*! ${POSTER_FONT_NOTICES["source-han-sans"].replaceAll("*/", "* /")} */\n/*! ${OFFLINE_MONO_NOTICE.replaceAll("*/", "* /")} */\n${css}` : css;
};

export type BodyFontId = RemoteNoteImageFont | keyof typeof LEGACY_BODY_FONTS;
export const loadBodyFont = async (id: BodyFontId, text: string) => {
  await loadOfflineFonts(text);
  if (id in LEGACY_BODY_FONTS) {
    const legacy = LEGACY_BODY_FONTS[id as keyof typeof LEGACY_BODY_FONTS];
    return loadFontBlocks([{ asset: pinnedFontUrl(legacy.resource), family: legacy.family, weight: "400", range: "U+0-10FFFF" }], text);
  }
  return loadCatalogFont(id as RemoteNoteImageFont, text);
};
