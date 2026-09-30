import { describe, expect, test } from "bun:test";
import { localizeMissingNotebookName, localizeUntitledMemoTitle, translateMobileText } from "./mobile-locale.tsx";

describe("mobile locale translation", () => {
  test("keeps Chinese copy unchanged for the Chinese locale", () => {
    expect(translateMobileText("正在同步笔记", "zh-CN")).toBe("正在同步笔记");
  });

  test("translates mobile-only static copy", () => {
    expect(translateMobileText("正在同步笔记", "en-US")).toBe("Syncing your notes");
    expect(translateMobileText("从相册选择", "en-US")).toBe("Choose from library");
    expect(translateMobileText("正在同步笔记", "ja")).toBe("ノートを同期しています");
    expect(translateMobileText("从相册选择", "ja")).toBe("ライブラリから選ぶ");
  });

  test("prefers specific mobile-only templates over broader templates", () => {
    expect(translateMobileText("已加载 12 / 40 条笔记", "en-US")).toBe("Loaded 12 of 40 notes");
    expect(translateMobileText("筛选：Pinned · 3 条", "en-US")).toBe("Filter: Pinned · 3 notes");
  });

  test("prefers specific shared templates over broader mobile-only templates", () => {
    expect(translateMobileText("永久删除 3 条笔记", "en-US")).toBe("Delete 3 notes permanently");
    expect(translateMobileText("当前：Inbox，3 条笔记", "en-US")).toBe("Current: Inbox, 3 notes");
  });

  test("translates the mixed English explanations from the Android locale report", () => {
    expect(translateMobileText("修改后会保留当前设备登录，并退出其他设备上的登录会话。", "en-US"))
      .toBe("Keeps this device signed in and signs out other sessions.");
    expect(translateMobileText("修改后会保留当前设备登录，并退出其他设备上的登录会话。", "ja"))
      .toBe("この端末のログインは維持し、他の端末のセッションは終了します。");
    expect(translateMobileText("添加标签", "en-US")).toBe("Add tags");
    expect(translateMobileText("没有找到适合这篇笔记的新标签。", "en-US")).toBe("No new tags fit this note.");
    expect(translateMobileText("切换产品界面的显示语言。", "en-US")).toBe("Choose the language used in the app.");
    expect(translateMobileText("当前密码不正确。", "en-US")).toBe("The current password is incorrect.");
    expect(translateMobileText("修改中...", "ja")).toBe("変更中...");
  });

  test("localizes only the default untitled title and the missing-notebook fallback", () => {
    expect(localizeUntitledMemoTitle("", "en-US")).toBe("Untitled note");
    expect(localizeUntitledMemoTitle("无标题笔记", "en-US")).toBe("Untitled note");
    expect(localizeUntitledMemoTitle("无标题笔记", "ja")).toBe("無題のノート");
    expect(localizeUntitledMemoTitle("  无标题笔记  ", "zh-CN")).toBe("无标题笔记");
    expect(localizeUntitledMemoTitle("会议记录", "en-US")).toBe("会议记录");
    expect(localizeMissingNotebookName("en-US")).toBe("Uncategorized");
    expect(localizeMissingNotebookName("ja")).toBe("未分類");
    expect(localizeMissingNotebookName("zh-CN")).toBe("未分类");
  });
});
