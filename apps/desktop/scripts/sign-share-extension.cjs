const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { createRequire } = require("node:module");
const { join } = require("node:path");

const builderRequire = createRequire(require.resolve("electron-builder/package.json"));
// `sign` is the legacy callback API and returns before signing finishes.
const { signApp } = builderRequire("@electron/osx-sign");

const codesign = (args) => {
  const result = spawnSync("codesign", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "codesign failed");
  }
};

const signingIdentity = (identity) => {
  if (typeof identity === "string" && identity) return identity;
  if (identity && typeof identity === "object") return identity.hash || identity.name || "";
  return "";
};

// electron-builder skips Contents/PlugIns, and it notarizes before afterSign.
// This replaces mac.sign so the share extension is Developer ID signed, timestamped,
// and hardened before notarization. The outer app is sealed again afterwards.
module.exports = async function signMacApp(opts) {
  await signApp(opts);
  const appexPath = join(opts.app, "Contents", "PlugIns", "EdgeEverShare.appex");
  if (!existsSync(appexPath)) {
    throw new Error(`macOS share extension is missing from the app bundle: ${appexPath}`);
  }
  const identity = signingIdentity(opts.identity);
  if (!identity) {
    throw new Error("macOS share extension cannot be signed without a Developer ID identity");
  }
  const entitlements = join(__dirname, "..", "share-extension", "EdgeEverShare.entitlements");
  const shared = ["--force", "--sign", identity, "--timestamp"];
  if (opts.keychain) shared.push("--keychain", opts.keychain);
  codesign([
    ...shared,
    "--options",
    "runtime",
    "--generate-entitlement-der",
    "--entitlements",
    entitlements,
    appexPath,
  ]);
  codesign([
    ...shared,
    "--preserve-metadata=entitlements,requirements,flags,runtime",
    opts.app,
  ]);
};
