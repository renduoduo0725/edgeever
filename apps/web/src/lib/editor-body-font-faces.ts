import { noteImageAssetUrls } from "@edgeever/shared/note-image-assets";
import { configureBundledFontAssets } from "@edgeever/shared/font-assets-registry";

/** Register default asset locations without downloading fonts for system typography. */
export const installEditorBodyFontFaces = () => {
  if (typeof document === "undefined") return;
  configureBundledFontAssets(noteImageAssetUrls);
};
