import { NOTE_IMAGE_EXPORT_PIXEL_RATIO } from "@edgeever/shared/note-image-card";

// Bound memory independently of canvas height: long, narrow cards can retain
// their resolution without hitting html-to-image's fixed 16,384px side limit.
export const planWebNoteImageRender = (width: number, height: number, maxDimension: number, maxPixels = 80_000_000) => {
  if (![width, height, maxDimension, maxPixels].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid note image dimensions");
  }
  return {
    pixelRatio: Math.min(
      NOTE_IMAGE_EXPORT_PIXEL_RATIO,
      maxDimension / Math.max(width, height),
      Math.sqrt(maxPixels / (width * height)),
    ),
  };
};
