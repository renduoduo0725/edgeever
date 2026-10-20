import { POSTER_DESIGN_TEMPLATES } from "@edgeever/shared";
import manifest from "@/assets/poster-template-previews/manifest.json";

const images = import.meta.glob<string>("../assets/poster-template-previews/*.webp", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});
export const POSTER_GALLERY_TEMPLATES = manifest.templates.map(entry => {
  const descriptor = POSTER_DESIGN_TEMPLATES.find(template => template.id === entry.id);
  if (!descriptor) throw new Error(`Unknown poster preview template: ${entry.id}`);
  return {
    ...descriptor,
    recommended: entry.recommended,
    thumbnails: {
      zh: images[`../assets/poster-template-previews/${entry.zh.file}`],
      en: images[`../assets/poster-template-previews/${entry.en.file}`],
    },
  };
});
export const posterGalleryTemplatesFor = (platformId?: string) =>
  POSTER_GALLERY_TEMPLATES.filter(template => template.recommended).sort((a, b) =>
    Number(b.fit.includes(platformId ?? "")) - Number(a.fit.includes(platformId ?? "")),
  );
