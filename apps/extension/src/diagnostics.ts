import type { ExtensionSettings } from "./extension";
import { t } from "./i18n";

export type DiagnosticInfo = {
  extensionVersion: string;
  manifestVersion: string;
  browser: string;
  system: string;
  extensionId: string;
  instanceOrigin: string;
  instancePermission: string;
};

const getBrowserLabel = () => {
  const userAgent = navigator.userAgent;
  const match = userAgent.match(/(Edg|Chrome|Firefox|Version)\/([\d.]+)/);
  if (!match) {
    return userAgent;
  }
  const name = match[1] === "Edg" ? "Microsoft Edge" : match[1] === "Version" ? "Safari" : match[1];
  return `${name} ${match[2]}`;
};

const getInstanceOrigin = (instanceUrl: string) => {
  if (!instanceUrl) {
    return t("notConfigured");
  }
  try {
    return new URL(instanceUrl).origin;
  } catch {
    return t("invalidInstanceAddress");
  }
};

export const getDiagnosticInfo = async (settings: ExtensionSettings): Promise<DiagnosticInfo> => {
  const manifest = chrome.runtime.getManifest() as { manifest_version?: number; version?: string };
  const instanceOrigin = getInstanceOrigin(settings.instanceUrl);
  let instancePermission = t("permissionNotConfigured");
  if (instanceOrigin.startsWith("http")) {
    const granted = await chrome.permissions.contains({ origins: [`${instanceOrigin}/*`] });
    instancePermission = granted ? t("permissionGranted") : t("permissionNotGranted");
  }

  return {
    extensionVersion: manifest.version || t("unknownValue"),
    manifestVersion: manifest.manifest_version ? String(manifest.manifest_version) : t("unknownValue"),
    browser: getBrowserLabel(),
    system: `${navigator.platform || t("unknownValue")} (${navigator.language || t("unknownValue")})`,
    extensionId: chrome.runtime.id || t("unknownValue"),
    instanceOrigin,
    instancePermission,
  };
};

export const diagnosticText = (info: DiagnosticInfo) => [
  "EdgeEver Web Clipper diagnostics",
  `Extension version: ${info.extensionVersion}`,
  `Manifest version: ${info.manifestVersion}`,
  `Browser: ${info.browser}`,
  `System: ${info.system}`,
  `Extension ID: ${info.extensionId}`,
  `Instance origin: ${info.instanceOrigin}`,
  `Instance permission: ${info.instancePermission}`,
  "Declared permissions: activeTab, scripting, storage",
].join("\n");
