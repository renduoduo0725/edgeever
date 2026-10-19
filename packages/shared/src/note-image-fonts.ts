import { NOTE_IMAGE_FONT_NOTICES } from "./note-image-font-notices";
import { NOTE_IMAGE_FONT_SUBSETS } from "./note-image-font-manifest";
import { NOTE_IMAGE_TEMPLATE_TYPOGRAPHY, resolveTheme, type NoteImageTheme, type NoteImageFontStyle } from "./note-image-card";
import { isRemoteNoteImageFont } from "./font-catalog";
import { configureBundledFontAssets, loadFontBlocks, loadCatalogFont, loadOfflineFonts, withFontDeadline } from "./font-loader";
import { pinnedFontUrl } from "./font-resources";
export { fontSubsetContains, createRemoteFontResourceLoader, loadRemoteFontResource } from "./font-loader";

type AssetUrl = string | number | { uri: string };
const resources = new Map<string, Promise<string>>();

const asDataUrl = (url: string): Promise<string> => {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let pending = resources.get(url);
  if (!pending) {
    pending = withFontDeadline(new Promise<string>((resolve, reject) => {
      // WKWebView's bundled file URLs support XMLHttpRequest, but not fetch.
      const request = new XMLHttpRequest();
      request.open("GET", url);
      request.responseType = "blob";
      request.timeout = 1_500;
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
    }), 1_500);
    resources.set(url, pending);
    void pending.catch(() => resources.delete(url));
  }
  return pending;
};

/** Optional fonts never prevent export. Picker previews remain strict so failure is visible. */
export const prepareNoteImageAssets = async ({ theme, fontStyle = "auto", text, urls, embed = true, fallbackOnError = embed }: {
  theme: NoteImageTheme; fontStyle?: NoteImageFontStyle; text: string; urls: Record<string, AssetUrl>; embed?: boolean; fallbackOnError?: boolean;
}) => {
  configureBundledFontAssets(urls);
  const active = resolveTheme(undefined, theme);
  const getAsset = (name: string) => {
    const asset = urls[name];
    if (!asset || typeof asset === "number") throw new Error("NOTE_IMAGE_ASSET_UNAVAILABLE");
    return asDataUrl(typeof asset === "string" ? asset : asset.uri);
  };
  const fallbackCss = await loadOfflineFonts(text, embed);
  const preset = NOTE_IMAGE_TEMPLATE_TYPOGRAPHY[active];
  const fontIds = [...new Set([...preset.body, ...preset.heading])];
  const catalog = fontStyle === "auto"
    ? fontIds.flatMap(id => NOTE_IMAGE_FONT_SUBSETS[id].map(block => ({ ...block, asset: pinnedFontUrl(`template/${block.asset}`) })))
    : [];
  let optionalCss = "";
  let fontFallback = false;
  let fontsReady: Promise<unknown> | undefined;
  try {
    const optional = isRemoteNoteImageFont(fontStyle)
      ? loadCatalogFont(fontStyle, text, { embed })
      : loadFontBlocks(catalog, text, { embed });
    // Retain the original operation so renderers can recover after the render deadline.
    fontsReady = optional;
    optionalCss = await (fallbackOnError ? withFontDeadline(optional) : optional);
  } catch (error) {
    if (!fallbackOnError) throw error;
    fontFallback = true;
  }
  const fontCss = [fallbackCss, optionalCss && `/*! ${NOTE_IMAGE_FONT_NOTICES.replaceAll("*/", "* /")} */\n${optionalCss}`].filter(Boolean).join("\n");
  let textureCss = "";
  try {
    textureCss = embed && active === "handwritten"
    ? `.edgeever-image-wrapper{--ee-paper:url("${await getAsset("paper.png")}");--ee-paper-grain:url("${await getAsset("paper-text.png")}")}`
    : embed && active === "book"
    ? `.edgeever-image-wrapper{--ee-paper:url("${await getAsset("paper.png")}")}`
    : "";
  } catch { /* The template's solid background remains readable if a texture is unavailable. */ }
  const fallbackStyle = fontFallback ? `.edgeever-image-wrapper,.edgeever-image-wrapper *{font-family:"EdgeEver Offline Sans",system-ui,sans-serif!important}.edgeever-image-wrapper pre,.edgeever-image-wrapper code{font-family:"Geist Mono Variable",monospace!important}` : "";
  return { fontCss, css: `${fontCss}\n${textureCss}\n${fallbackStyle}`, fontFallback, fontsReady: fontFallback ? fontsReady : undefined };
};
