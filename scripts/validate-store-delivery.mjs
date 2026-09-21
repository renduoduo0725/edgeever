import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planNativeRelease } from "./plan-native-release.mjs";

const STABLE_RELEASE_TAG = /^v(\d+\.\d+\.\d+)$/;
const PLATFORMS = new Set(["android", "ios", "both"]);
const ANDROID_TRACKS = new Set(["internal", "alpha", "beta", "production"]);

export const readIosMarketingVersion = (text) => {
  const match = String(text).match(/^MARKETING_VERSION\s*=\s*(\S+)/m);
  if (!match) {
    throw new Error("apps/ios/Config/Version.xcconfig is missing MARKETING_VERSION.");
  }
  return match[1];
};

export const validateStoreDelivery = ({
  releaseTag,
  rootVersion,
  mobileVersion,
  iosVersion,
  currentVersionCode,
  previousVersionCode,
  changedFiles,
  platform,
  androidTrack,
}) => {
  const version = STABLE_RELEASE_TAG.exec(releaseTag)?.[1];
  if (!version) {
    throw new Error(`Release tag must use stable vX.Y.Z format: ${releaseTag}`);
  }
  if (!ANDROID_TRACKS.has(androidTrack)) {
    throw new Error(`Unsupported Google Play track: ${androidTrack}`);
  }
  if (!PLATFORMS.has(platform)) {
    throw new Error(`Unsupported store platform: ${platform}`);
  }
  if (rootVersion !== version) {
    throw new Error(`${releaseTag} requires package.json version to equal ${version}.`);
  }

  const relevantChanges = [];
  const deliverAndroid = platform === "android" || platform === "both";
  const deliverIos = platform === "ios" || platform === "both";

  if (deliverAndroid) {
    const mobilePlan = planNativeRelease("mobile", changedFiles);
    if (!mobilePlan.rebuild) {
      throw new Error(
        `${releaseTag} contains no Android runtime changes; keep the existing store binary.`,
      );
    }
    if (mobileVersion !== version) {
      throw new Error(
        `${releaseTag} requires apps/mobile/app.json version to equal ${version}.`,
      );
    }
    if (
      !Number.isInteger(currentVersionCode) ||
      !Number.isInteger(previousVersionCode) ||
      currentVersionCode <= previousVersionCode
    ) {
      throw new Error(
        `Android versionCode must increase beyond ${previousVersionCode}; received ${currentVersionCode}.`,
      );
    }
    relevantChanges.push(...mobilePlan.relevantChanges);
  }

  if (deliverIos) {
    const iosPlan = planNativeRelease("ios", changedFiles);
    if (!iosPlan.rebuild) {
      throw new Error(
        `${releaseTag} contains no iOS runtime changes; keep the existing App Store binary.`,
      );
    }
    if (iosVersion !== version) {
      throw new Error(
        `${releaseTag} requires apps/ios/Config/Version.xcconfig MARKETING_VERSION to equal ${version}.`,
      );
    }
    relevantChanges.push(...iosPlan.relevantChanges);
  }

  return {
    version,
    versionCode: deliverAndroid ? currentVersionCode : previousVersionCode,
    relevantChanges,
  };
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const run = () => {
  const [
    releaseTag,
    previousTag,
    platform = "both",
    androidTrack = "production",
  ] = process.argv.slice(2);
  if (!releaseTag || !previousTag) {
    console.error(
      "Usage: node scripts/validate-store-delivery.mjs <release-tag> <previous-tag> [platform] [android-track]",
    );
    process.exit(2);
  }

  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8" }).trim();
  const changedFiles = git(
    "diff",
    "--name-only",
    `${previousTag}...${releaseTag}`,
  ).split("\n").filter(Boolean);
  const rootPackage = readJson("package.json");
  const mobileConfig = readJson("apps/mobile/app.json");
  const previousMobileConfig = JSON.parse(
    git("show", `${previousTag}:apps/mobile/app.json`),
  );
  const iosVersion = readIosMarketingVersion(
    readFileSync("apps/ios/Config/Version.xcconfig", "utf8"),
  );
  const result = validateStoreDelivery({
    releaseTag,
    rootVersion: rootPackage.version,
    mobileVersion: mobileConfig.expo.version,
    iosVersion,
    currentVersionCode: mobileConfig.expo.android.versionCode,
    previousVersionCode: previousMobileConfig.expo.android.versionCode,
    changedFiles,
    platform,
    androidTrack,
  });

  process.stdout.write(`version=${result.version}\n`);
  process.stdout.write(`version_code=${result.versionCode}\n`);
  process.stdout.write("mobile_changed=true\n");
  process.stderr.write(
    `Store delivery ${releaseTag}: ${result.relevantChanges.join(", ")}\n`,
  );
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    run();
  } catch (error) {
    console.error(
      `[store-delivery] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
