import { OFFLINE_SANS_URL, OFFLINE_MONO_URL } from "./font-defaults";

export type FontAssetUrl = string | number | { uri: string };
export const bundledResources = new Map<string, string>();
export const configureBundledFontAssets = (urls: Record<string, FontAssetUrl>) => {
  for (const [key, canonical] of [["offline-sans.woff2", OFFLINE_SANS_URL], ["geist/GeistMono.ttf", OFFLINE_MONO_URL]]) {
    const asset = urls[key];
    if (asset && typeof asset !== "number") bundledResources.set(canonical, typeof asset === "string" ? asset : asset.uri);
  }
};
