/** Small fallback descriptors; optional download integrity tables stay out of startup. */
export const OFFLINE_SANS_FAMILY = "EdgeEver Offline Sans";
export const OFFLINE_MONO_FAMILY = "Geist Mono Variable";
export const OFFLINE_SANS_URL = "https://cdn.jsdelivr.net/gh/tianma-if/edgeever@0da78f6ce8a4643b2dfb7afe9f7a5101472c4ffb/apps/web/public/poster-fonts/notosans.woff2";
export const OFFLINE_MONO_URL = "https://cdn.jsdelivr.net/gh/tianma-if/edgeever@cb13c0759256caed174b4063845c7948d90fc1bd/packages/shared/src/note-image-assets/geist/GeistMono.ttf";
export const LEGACY_BODY_FONTS = {
  "wenkai-screen": { resource: "body/kai-screen.woff2", family: "EdgeEver Kai Screen" },
  "neo-zhi-song": { resource: "body/zhi-song.woff2", family: "EdgeEver Zhi Song" },
  "source-serif": { resource: "body/source-serif-4-regular.woff2", family: "Source Serif 4" },
} as const;
