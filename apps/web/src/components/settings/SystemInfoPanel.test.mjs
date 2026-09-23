import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(new URL("./SystemInfoPanel.tsx", import.meta.url), "utf8");
const feedbackSource = readFileSync(new URL("./FeedbackLink.tsx", import.meta.url), "utf8");
const syncIssueSource = readFileSync(new URL("../DesktopSyncIssuesDialog.tsx", import.meta.url), "utf8");

describe("system information client/instance version hint", () => {
  test("warns in system info when the client is ahead of the connected instance", () => {
    expect(source).toContain("isClientAheadOfInstance");
    expect(source).toContain("clientRuntimeQuery.data?.appVersion ?? __EDGEEVER_APP_VERSION__");
    expect(source).toContain("release?.version");
    expect(source).toContain("clientAheadOfInstanceByPlatform");
    expect(source).toContain("resolveDeploymentPlatform(healthQuery.data?.health?.runtime)");
    expect(source).toContain("clientAheadOfInstance");
  });
});

describe("system information diagnostic fields", () => {
  test("shows desktop instance URL as local-only field and omits data directory", () => {
    expect(source).toContain('t("systemInfo.instanceUrl")');
    expect(source).not.toContain('t("systemInfo.dataDirectory")');
    expect(source).toContain("localOnly: true");
    expect(source).toContain('clientKind === "desktopApp"');
    expect(source).toContain("getShareableWebSystemInfoItems");
    expect(source).toContain(".filter((item) => !item.localOnly)");
    expect(feedbackSource).toContain("getShareableWebSystemInfoItems");
    expect(feedbackSource.replaceAll("getShareableWebSystemInfoItems", "")).not.toContain("getWebSystemInfoItems");
    expect(syncIssueSource).toContain("getShareableWebSystemInfoItems");
    expect(syncIssueSource.replaceAll("getShareableWebSystemInfoItems", "")).not.toContain("getWebSystemInfoItems");
  });

  test("includes current device model from client runtime diagnostics", () => {
    expect(source).toContain('t("systemInfo.deviceModel")');
    expect(source).toContain("diagnostics.clientRuntime?.deviceModel");
    expect(feedbackSource).toContain("getClientRuntimeDiagnostics");
    expect(feedbackSource).toContain("clientRuntime: clientRuntimeQuery.data");
  });

  test("includes current screen resolution", () => {
    expect(source).toContain('t("systemInfo.screenResolution")');
    expect(source).toContain('t("systemInfo.screenResolutionValue", parts)');
    expect(source).toMatch(/systemInfo\.screenResolution[\s\S]{0,220}colSpan: "full"/);
    expect(source).toContain("readBrowserClientDisplaySize");
    expect(source).toContain("getClientDisplaySizeParts");
    expect(source).toContain('window.addEventListener("resize", onResize)');
    expect(readFileSync(new URL("../../lib/system-diagnostics.ts", import.meta.url), "utf8")).toContain("toDevicePixelScreenSize");
  });

  test("distinguishes empty sync from never synced", () => {
    expect(source).not.toContain('t("systemInfo.authMode")');
    expect(source).toContain('t("systemInfo.nothingToSync")');
    expect(source).toContain('t("systemInfo.neverSynced")');
    expect(source).toContain("formatLastSuccessfulSync");
  });
});

describe("system information copy feedback", () => {
  test("shows visible success and failure feedback", () => {
    expect(source).toContain('useState<"idle" | "copied" | "error">');
    expect(source).toContain("<ClipboardCopyNotice");
    expect(source).toContain("systemInfo.copySucceeded");
    expect(source).toContain("systemInfo.copyFailed");
    expect(source).toContain('copyState === "error"');
    expect(source).toContain("formatSystemInfoClipboard");
    expect(source).toContain("copyHtmlToClipboard");
  });
});
