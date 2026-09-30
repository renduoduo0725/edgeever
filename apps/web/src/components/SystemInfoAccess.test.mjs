import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const headerActionsSource = readFileSync(new URL("./MemoEditorHeaderActions.tsx", import.meta.url), "utf8");
const settingsPaneSource = readFileSync(new URL("./SettingsPane.tsx", import.meta.url), "utf8");
const notebookPaneSource = readFileSync(new URL("./NotebookPane.tsx", import.meta.url), "utf8");
const mobileChromeSource = readFileSync(new URL("./WorkspaceMobileChrome.tsx", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("./settings/SystemInfoPanel.tsx", import.meta.url), "utf8");

describe("system information access", () => {
  test("keeps system information out of the note overflow menu", () => {
    expect(headerActionsSource).not.toContain("systemInfo.title");
    expect(headerActionsSource).not.toContain("SystemInfoDialog");
    expect(headerActionsSource).not.toContain("deployedUpdateUnseen");
  });

  test("adds system information to the settings navigation on desktop and mobile", () => {
    expect(settingsPaneSource).toContain('key: "system"');
    expect(settingsPaneSource).toContain('label: t("systemInfo.title")');
    expect(settingsPaneSource).toContain("<SystemInfoPanel");
    expect(settingsPaneSource).not.toContain("SystemInfoDialog");
    expect(settingsPaneSource).toContain('item.key !== "shortcuts"');
    expect(settingsPaneSource).not.toContain('item.key !== "system"');

    const desktopSettings = settingsPaneSource.match(/桌面端布局：双栏[\s\S]*?移动端布局/)?.[0] ?? "";
    const mobileSettings = settingsPaneSource.match(/移动端布局[\s\S]*$/)?.[0] ?? "";
    expect(desktopSettings).toContain("tabItems.map");
    expect(mobileSettings).toContain("mobileTabItems.map");
    expect(desktopSettings).toContain('item.key === "system" && deployedUpdateUnseen');
    expect(mobileSettings).toContain('item.key === "system" && deployedUpdateUnseen');
  });

  test("points the deployed-update dot at personal settings until the page is opened", () => {
    expect(notebookPaneSource).toContain("notice={deployedUpdateUnseen}");
    expect(notebookPaneSource).toContain("deployedUpdateUnseen ?");
    expect(mobileChromeSource).toContain("notice={deployedUpdateUnseen}");
    expect(panelSource).toContain("if (active) markSeen()");
  });
});
