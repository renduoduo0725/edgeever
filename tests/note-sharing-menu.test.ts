import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { enUS } from "../packages/shared/src/i18n/en-US";
import { zhCN } from "../packages/shared/src/i18n/zh-CN";

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const editorSource = readSource("../apps/web/src/components/EditorPane.tsx");
const memoListSource = readSource("../apps/web/src/components/MemoListPane.tsx");
const shareDialogSource = readSource("../apps/web/src/components/dialogs/ShareMemoDialog.tsx");
const publicShareSource = readSource("../apps/web/src/components/PublicSharePage.tsx");

describe("note sharing menu", () => {
  test("explains why sharing a newly created local note is disabled", () => {
    expect(zhCN.sharing.afterSync).toBe("同步后可分享笔记");
    expect(enUS.sharing.afterSync).toBe("Share note after sync");
    expect(editorSource).toContain('isLocalMemoId(memo.id) ? "sharing.afterSync"');
    expect(memoListSource).toContain('isLocalMemoId(memoContextMenu.memo.id) ? "sharing.afterSync"');
  });

  test("share dialog can enable an auto-generated access password", () => {
    expect(zhCN.sharing.passwordToggle).toBe("访问密码");
    expect(enUS.sharing.passwordToggle).toBe("Access password");
    expect(shareDialogSource).toContain('t("sharing.passwordToggle")');
    expect(shareDialogSource).toContain("api.updateMemoShare(memoId, { passwordProtected })");
    expect(publicShareSource).toContain("api.unlockPublicMemoShare");
    expect(publicShareSource).toContain("parsePublishedNoteBodyFont(share.bodyFont)");
    expect(publicShareSource).toContain("applyEditorBodyFontPreference({ choice: publishedBodyFont, customFamily: \"\" })");
  });
});
