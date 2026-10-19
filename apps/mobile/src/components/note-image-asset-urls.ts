// Metro needs static requires. Keep this list identical to the shared Web/iOS defaults.
export const noteImageAssetUrls: Record<string, string | number | { uri: string }> = {
  "offline-sans.woff2": require("../../../../packages/shared/src/font-assets/poster/notosans.woff2"),
  "geist/GeistMono.ttf": require("../../../../packages/shared/src/note-image-assets/geist/GeistMono.ttf"),
  "paper.png": require("../../../../packages/shared/src/note-image-assets/paper.png"),
  "paper-text.png": require("../../../../packages/shared/src/note-image-assets/paper-text.png"),
};
