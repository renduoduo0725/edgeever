// Only defaults and small textures ship in clients; optional fonts use pinned downloads.
export const noteImageAssetUrls: Record<string, string> = {
  "offline-sans.woff2": new URL("./font-assets/poster/notosans.woff2", import.meta.url).href,
  "geist/GeistMono.ttf": new URL("./note-image-assets/geist/GeistMono.ttf", import.meta.url).href,
  "paper.png": new URL("./note-image-assets/paper.png", import.meta.url).href,
  "paper-text.png": new URL("./note-image-assets/paper-text.png", import.meta.url).href,
};
