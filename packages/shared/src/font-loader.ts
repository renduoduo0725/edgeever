import { readFontCache, writeFontCache } from "./note-image-font-cache";
import { FONT_CATALOG, parseRemoteFontCss, remoteFontCssUrl, remoteFontUrls, remoteOriginalFont, remoteFontIntegrity, type RemoteNoteImageFont } from "./font-catalog";
import { NOTE_IMAGE_REMOTE_FONT_NOTICES } from "./note-image-remote-font-notices";

const validRemoteResource = async (data: ArrayBuffer, css: boolean, url: string) => {
  const valid = data.byteLength > (css ? 0 : 48)
  && data.byteLength <= (css ? 1_000_000 : 24_000_000)
  && (css ? new TextDecoder().decode(data).includes("@font-face")
    : (new TextDecoder().decode(data.slice(0, 4)) === "wOF2" && new DataView(data).getUint32(8) === data.byteLength)
      || new DataView(data).getUint32(0) === 0x00010000 || new TextDecoder().decode(data.slice(0, 4)) === "OTTO");
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

/** Cache manifests as well as subsets, so a later export works without the network. */
export const createRemoteFontResourceLoader = () => {
  const remoteResources = new Map<string, Promise<ArrayBuffer>>();
  return (url: string, css = false): Promise<ArrayBuffer> => {
    let pending = remoteResources.get(url);
    if (!pending) {
      pending = (async () => {
        const cached = await readFontCache(url);
        if (cached && await validRemoteResource(cached, css, url)) return cached;
        for (const mirror of remoteFontUrls(url)) {
          try {
            const data = await new Promise<ArrayBuffer>((resolve, reject) => {
              const request = new XMLHttpRequest();
              request.open("GET", mirror);
              request.responseType = "arraybuffer";
              request.timeout = 15_000;
              request.onload = () => request.status === 200 && request.response instanceof ArrayBuffer
                ? resolve(request.response) : reject(new Error("NOTE_IMAGE_FONT_UNAVAILABLE"));
              request.onerror = request.ontimeout = () => reject(new Error("NOTE_IMAGE_FONT_UNAVAILABLE"));
              request.send();
            });
            if (!await validRemoteResource(data, css, url)) continue;
            await writeFontCache(url, data);
            return data;
          } catch { /* Try the second pinned mirror. Never send note text to either host. */ }
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
  const points = new Set(Array.from(text, char => char.codePointAt(0)!));
  const blocks = catalog.filter(block => fontSubsetContains(block.range, points));
  const css = await Promise.all(blocks.map(async block => {
    const key = `${family}:${block.asset}`;
    let pending = faces.get(key);
    if (!pending) {
      pending = (async () => {
        const data = await loadRemoteFontResource(block.asset);
        const face = new FontFace(family, data, { weight: block.weight, unicodeRange: block.range });
        await face.load();
        document.fonts.add(face);
        return face;
      })();
      faces.set(key, pending);
      void pending.catch(() => faces.delete(key));
    }
    await pending;
    return embed ? `@font-face{font-family:"${family}";font-style:normal;font-weight:${block.weight};src:url("${await remoteDataUrl(block.asset)}");unicode-range:${block.range}}` : "";
  }));
  if (!embed || !blocks.length) return "";
  const notices = original
    ? `Original font loaded unchanged from ${original.asset}. Original copyright and licensing metadata are retained in the font container. Alibaba: https://fonts.alibabagroup.com/ ; YouShe: https://www.uisdc.com/ . No conversion or subsetting is performed.`
    : NOTE_IMAGE_REMOTE_FONT_NOTICES;
  return `/*! ${notices.replaceAll("*/", "* /")} */\n${css.join("\n")}`;
};
