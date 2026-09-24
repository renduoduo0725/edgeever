import { dirname, join } from "node:path";

export const SHARE_EXTENSION_BUNDLE_ID = "org.edgeever.desktop.share";

export const macShareExtensionPath = (executablePath) =>
  join(dirname(executablePath), "..", "PlugIns", "EdgeEverShare.appex");

// macOS leaves a newly installed share extension disabled. The host app has to
// elect it, or WeChat's share sheet never lists EdgeEver for that user.
export const enableMacShareExtension = async ({
  platform,
  packaged,
  executablePath,
  exists,
  execFile,
}) => {
  if (platform !== "darwin" || !packaged) return { enabled: false };
  const appexPath = macShareExtensionPath(executablePath);
  if (!exists(appexPath)) return { enabled: false };
  await runPluginkit(execFile, ["-a", appexPath]);
  await runPluginkit(execFile, ["-e", "use", "-i", SHARE_EXTENSION_BUNDLE_ID]);
  return { enabled: true };
};

const runPluginkit = (execFile, args) => new Promise((resolve, reject) => {
  execFile("/usr/bin/pluginkit", args, { timeout: 10_000 }, (error) => {
    if (error) reject(error);
    else resolve();
  });
});
