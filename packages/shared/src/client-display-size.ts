export type ClientDisplaySizeInput = {
  devicePixelRatio: number;
  screenHeight: number;
  screenWidth: number;
};

export type ClientDisplaySizeParts = {
  dpr: string;
  screen: string;
};

const formatDisplayPixels = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  return String(Math.round(value));
};

export const formatDevicePixelRatio = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const scaleCssPixelsToDevicePixels = (cssPixels: number, devicePixelRatio: number) => {
  if (!Number.isFinite(cssPixels) || cssPixels <= 0) return cssPixels;
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return cssPixels;
  return cssPixels * devicePixelRatio;
};

// Browser `screen` APIs report CSS pixels; system info shows the device-pixel panel size.
export const toDevicePixelScreenSize = (input: ClientDisplaySizeInput): ClientDisplaySizeInput => ({
  devicePixelRatio: input.devicePixelRatio,
  screenHeight: scaleCssPixelsToDevicePixels(input.screenHeight, input.devicePixelRatio),
  screenWidth: scaleCssPixelsToDevicePixels(input.screenWidth, input.devicePixelRatio),
});

export const getClientDisplaySizeParts = (
  input: ClientDisplaySizeInput,
): ClientDisplaySizeParts | null => {
  const screenWidth = formatDisplayPixels(input.screenWidth);
  const screenHeight = formatDisplayPixels(input.screenHeight);
  const dpr = formatDevicePixelRatio(input.devicePixelRatio);
  if (!screenWidth || !screenHeight || !dpr) return null;
  return {
    dpr,
    screen: `${screenWidth}×${screenHeight}`,
  };
};

export const formatClientDisplaySize = (
  input: ClientDisplaySizeInput,
  template: string,
): string | null => {
  const parts = getClientDisplaySizeParts(input);
  if (!parts) return null;
  return template
    .replaceAll("{{screen}}", parts.screen)
    .replaceAll("{{dpr}}", parts.dpr);
};
