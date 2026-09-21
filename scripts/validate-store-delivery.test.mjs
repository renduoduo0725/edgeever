import { describe, expect, test } from "bun:test";
import { validateStoreDelivery } from "./validate-store-delivery.mjs";

const validInput = {
  releaseTag: "v1.7.0",
  rootVersion: "1.7.0",
  mobileVersion: "1.7.0",
  iosVersion: "1.7.0",
  currentVersionCode: 57,
  previousVersionCode: 56,
  changedFiles: ["apps/mobile/src/screens/WorkspaceScreen.tsx"],
  platform: "android",
  androidTrack: "production",
};

describe("store delivery validation", () => {
  test("accepts an Android release with increasing versions", () => {
    expect(validateStoreDelivery(validInput)).toEqual({
      version: "1.7.0",
      versionCode: 57,
      relevantChanges: ["apps/mobile/src/screens/WorkspaceScreen.tsx"],
    });
  });

  test("accepts an iOS release when the native client changed", () => {
    expect(
      validateStoreDelivery({
        ...validInput,
        platform: "ios",
        changedFiles: ["apps/ios/EdgeEver/App/RootView.swift"],
      }),
    ).toEqual({
      version: "1.7.0",
      versionCode: 56,
      relevantChanges: ["apps/ios/EdgeEver/App/RootView.swift"],
    });
  });

  test("accepts a combined delivery when both runtimes changed", () => {
    expect(
      validateStoreDelivery({
        ...validInput,
        platform: "both",
        changedFiles: [
          "apps/mobile/src/screens/WorkspaceScreen.tsx",
          "apps/ios/EdgeEver/App/RootView.swift",
        ],
      }),
    ).toEqual({
      version: "1.7.0",
      versionCode: 57,
      relevantChanges: [
        "apps/mobile/src/screens/WorkspaceScreen.tsx",
        "apps/ios/EdgeEver/App/RootView.swift",
      ],
    });
  });

  test("rejects Android delivery that reuses the existing mobile binary", () => {
    expect(() =>
      validateStoreDelivery({
        ...validInput,
        changedFiles: ["apps/web/src/app/App.tsx"],
      })
    ).toThrow("contains no Android runtime changes");
  });

  test("rejects iOS delivery that reuses the existing App Store binary", () => {
    expect(() =>
      validateStoreDelivery({
        ...validInput,
        platform: "ios",
        changedFiles: ["apps/mobile/src/screens/WorkspaceScreen.tsx"],
      })
    ).toThrow("contains no iOS runtime changes");
  });

  test("requires the Android app version to match the Release tag", () => {
    expect(() =>
      validateStoreDelivery({ ...validInput, mobileVersion: "1.6.99" })
    ).toThrow("apps/mobile/app.json version to equal 1.7.0");
  });

  test("requires the iOS marketing version to match the Release tag", () => {
    expect(() =>
      validateStoreDelivery({
        ...validInput,
        platform: "ios",
        iosVersion: "1.6.99",
        changedFiles: ["apps/ios/EdgeEver/App/RootView.swift"],
      })
    ).toThrow("MARKETING_VERSION to equal 1.7.0");
  });

  test("requires Android versionCode to increase", () => {
    expect(() =>
      validateStoreDelivery({ ...validInput, currentVersionCode: 56 })
    ).toThrow("versionCode must increase");
  });
});
