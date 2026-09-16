import { ImageGallery, MergeDivider } from "@edgeever/shared";
import { createNativeImageGalleryView } from "@edgeever/shared/native-image-gallery";

export { ImageGallery, MergeDivider };

/** Same schema as shared `ImageGallery`; only the native node view differs. */
export const createIosImageGallery = (getLocale: () => string) =>
  ImageGallery.extend({
    addNodeView() {
      return createNativeImageGalleryView(getLocale);
    },
  });
