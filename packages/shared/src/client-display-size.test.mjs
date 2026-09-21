import { describe, expect, test } from "bun:test";
import { formatClientDisplaySize, formatDevicePixelRatio, getClientDisplaySizeParts, toDevicePixelScreenSize } from "./client-display-size";

const template = "{{screen}} @{{dpr}}x";

describe("client display size formatting", () => {
  test("exposes interpolation parts for localized system info", () => {
    expect(getClientDisplaySizeParts({
      devicePixelRatio: 2,
      screenHeight: 982,
      screenWidth: 1512,
    })).toEqual({
      dpr: "2",
      screen: "1512×982",
    });
  });

  test("formats screen size and device pixel ratio", () => {
    expect(formatClientDisplaySize({
      devicePixelRatio: 2,
      screenHeight: 982,
      screenWidth: 1512,
    }, template)).toBe("1512×982 @2x");
    expect(formatClientDisplaySize({
      devicePixelRatio: 1.25,
      screenHeight: 1080,
      screenWidth: 1920,
    }, template)).toBe("1920×1080 @1.25x");
  });

  test("rounds css pixels and trims integer device pixel ratios", () => {
    expect(formatDevicePixelRatio(2)).toBe("2");
    expect(formatDevicePixelRatio(1.5)).toBe("1.5");
    expect(formatDevicePixelRatio(1.333333)).toBe("1.33");
    expect(formatClientDisplaySize({
      devicePixelRatio: 2.0000001,
      screenHeight: 981.4,
      screenWidth: 1511.6,
    }, template)).toBe("1512×981 @2x");
  });

  test("scales CSS screen size to device pixels", () => {
    expect(toDevicePixelScreenSize({
      devicePixelRatio: 2,
      screenHeight: 1080,
      screenWidth: 1920,
    })).toEqual({
      devicePixelRatio: 2,
      screenHeight: 2160,
      screenWidth: 3840,
    });
    expect(formatClientDisplaySize(toDevicePixelScreenSize({
      devicePixelRatio: 2,
      screenHeight: 1080,
      screenWidth: 1920,
    }), template)).toBe("3840×2160 @2x");
  });

  test("returns null when a display metric is missing", () => {
    expect(formatClientDisplaySize({
      devicePixelRatio: 2,
      screenHeight: 982,
      screenWidth: 0,
    }, template)).toBeNull();
    expect(formatDevicePixelRatio(0)).toBeNull();
    expect(formatDevicePixelRatio(Number.NaN)).toBeNull();
  });
});
