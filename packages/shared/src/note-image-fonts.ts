import { NOTE_IMAGE_FONT_NOTICES } from "./note-image-font-notices";
import { NOTE_IMAGE_FONT_SUBSETS } from "./note-image-font-manifest";
import { resolveTheme, type NoteImageTheme, type NoteImageFontStyle } from "./note-image-card";
import { isRemoteNoteImageFont } from "./font-catalog";
import { fontSubsetContains, loadCatalogFont } from "./font-loader";
export { fontSubsetContains, createRemoteFontResourceLoader, loadRemoteFontResource } from "./font-loader";

export const NOTE_IMAGE_THEME_FONTS = {
  gradient: "puhui", glass: "puhui", quote: "mincho", book: "song", memo: "misans",
  bento: "puhui", "black-sun": "puhui", frame: "puhui", handwritten: "longcang", code: "geist",
} as const;

type AssetUrl = string | number | { uri: string };
const resources = new Map<string, Promise<string>>();
const loadedFaces = new Map<string, Promise<FontFace>>();

const asDataUrl = (url: string): Promise<string> => {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let pending = resources.get(url);
  if (!pending) {
    pending = new Promise<string>((resolve, reject) => {
      // WKWebView's bundled file URLs support XMLHttpRequest, but not fetch.
      const request = new XMLHttpRequest();
      request.open("GET", url);
      request.responseType = "blob";
      request.timeout = 20_000;
      request.onload = () => {
        if ((request.status !== 0 && request.status !== 200) || !request.response?.size) {
          reject(new Error("NOTE_IMAGE_ASSET_UNAVAILABLE"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("NOTE_IMAGE_ASSET_UNAVAILABLE"));
        reader.readAsDataURL(request.response);
      };
      request.onerror = request.ontimeout = () => reject(new Error("NOTE_IMAGE_ASSET_UNAVAILABLE"));
      request.send();
    });
    resources.set(url, pending);
    void pending.catch(() => resources.delete(url));
  }
  return pending;
};

/** Only embed subsets used by this card. The editor never eagerly loads entire CJK fonts. */
export const prepareNoteImageAssets = async ({ theme, fontStyle = "auto", text, urls, embed = true }: {
  theme: NoteImageTheme; fontStyle?: NoteImageFontStyle; text: string; urls: Record<string, AssetUrl>; embed?: boolean;
}) => {
  const active = resolveTheme(undefined, theme);
  const getAsset = (name: string) => {
    const asset = urls[name];
    if (!asset || typeof asset === "number") throw new Error("NOTE_IMAGE_ASSET_UNAVAILABLE");
    return asDataUrl(typeof asset === "string" ? asset : asset.uri);
  };
  const points = new Set(Array.from(text, char => char.codePointAt(0)!));
  const remote = isRemoteNoteImageFont(fontStyle);
  const catalog = !remote && fontStyle === "auto" ? NOTE_IMAGE_FONT_SUBSETS[NOTE_IMAGE_THEME_FONTS[active]] : [];
  const blocks = catalog.filter(block => fontSubsetContains(block.range, points));
  const fontFacesCss = (await Promise.all(blocks.map(async block => {
    let loaded = loadedFaces.get(block.asset);
    // Picker labels only need the face registered, not another base64 export copy.
    const data = embed || !loaded ? await getAsset(block.asset) : "";
    loaded = loadedFaces.get(block.asset);
    if (!loaded) {
      const face = new FontFace(block.family, `url("${data}")`, { weight: block.weight, unicodeRange: block.range });
      loaded = face.load().then(font => { document.fonts.add(font); return font; });
      loadedFaces.set(block.asset, loaded);
      void loaded.catch(() => loadedFaces.delete(block.asset));
    }
    await loaded;
    return embed ? `@font-face{font-family:"${block.family}";font-style:normal;font-weight:${block.weight};src:url("${data}");unicode-range:${block.range}}` : "";
  }))).join("\n");
  const fontCss = remote
    ? await loadCatalogFont(fontStyle, text, { embed })
    : embed && blocks.length ? `/*! ${NOTE_IMAGE_FONT_NOTICES.replaceAll("*/", "* /")} */\n${fontFacesCss}` : "";
  const textureCss = embed && active === "handwritten"
    ? `.edgeever-image-wrapper{--ee-paper:url("${await getAsset("paper.png")}");--ee-paper-grain:url("${await getAsset("paper-text.png")}")}`
    : "";
  return { fontCss, css: `${fontCss}\n${textureCss}` };
};
