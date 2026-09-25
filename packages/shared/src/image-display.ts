export const DEFAULT_IMAGE_WIDTH_PERCENT = 72;
export const MIN_IMAGE_WIDTH_PERCENT = 25;
export const MAX_IMAGE_WIDTH_PERCENT = 100;

export const IMAGE_WIDTH_PRESETS = [
  { id: "small", width: 35, labelKey: "editor.imageSizeSmall" },
  { id: "medium", width: 50, labelKey: "editor.imageSizeMedium" },
  { id: "large", width: 72, labelKey: "editor.imageSizeLarge" },
  { id: "full", width: 100, labelKey: "editor.imageSizeFull" },
] as const;

export const NEW_IMAGE_WIDTH_PERCENT = IMAGE_WIDTH_PRESETS[0].width;

export type ImageWidthPresetId = (typeof IMAGE_WIDTH_PRESETS)[number]["id"];

export const clampImageWidth = (width: number): number =>
  Math.min(MAX_IMAGE_WIDTH_PERCENT, Math.max(MIN_IMAGE_WIDTH_PERCENT, Math.round(width)));

export const parseImageWidth = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampImageWidth(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = /(\d+(?:\.\d+)?)/.exec(value);
  return match ? clampImageWidth(Number(match[1])) : null;
};
