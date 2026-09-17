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
  test("shows desktop instance URL and data directory only as local-only fields", () => {
    expect(source).toContain('t("systemInfo.instanceUrl")');
    expect(source).toContain('t("systemInfo.dataDirectory")');
    expect(source).toContain("localOnly: true");
    expect(source).toContain('clientKind === "desktopApp"');
    expect(source).toContain("getShareableWebSystemInfoItems");
    expect(source).toContain(".filter((item) => !item.localOnly)");
    expect(feedbackSource).toContain("getShareableWebSystemInfoItems");
    expect(feedbackSource.replaceAll("getShareableWebSystemInfoItems", "")).not.toContain("getWebSystemInfoItems");
    expect(syncIssueSource).toContain("getShareableWebSystemInfoItems");
    expect(syncIssueSource.replaceAll("getShareableWebSystemInfoItems", "")).not.toContain("getWebSystemInfoItems");
  });

  test("distinguishes empty sync from never synced", () => {
    expect(source).not.toContain('t("systemInfo.authMode")');
    expect(source).toContain('t("systemInfo.nothingToSync")');
    expect(source).toContain('t("systemInfo.neverSynced")');
    expect(source).toContain("formatLastSuccessfulSync");
  });
});
