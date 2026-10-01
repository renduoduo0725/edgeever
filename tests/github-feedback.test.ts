import { describe, expect, test } from "bun:test";
import { buildGitHubFeedbackUrl } from "../packages/shared/src/github-feedback";

describe("buildGitHubFeedbackUrl", () => {
  test("prefills localized feedback copy and system information", () => {
    const url = new URL(
      buildGitHubFeedbackUrl({
        contentHeading: "反馈内容",
        contentPrompt: "请描述问题",
        privacyNotice: "请勿提交隐私信息",
        systemInfo: [
          { label: "版本号", value: "v0.5.0" },
          { label: "系统", value: "Android 16" },
        ],
        systemInfoHeading: "系统信息",
        systemInfoNotice: "自动生成",
        titlePrefix: "[反馈] ",
      })
    );

    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/tianma-if/edgeever/issues/new");
    expect(url.searchParams.get("title")).toBe("[反馈] ");
    expect(url.searchParams.get("body")).toContain("## 反馈内容");
    expect(url.searchParams.get("body")).toContain("- 版本号: v0.5.0");
    expect(url.searchParams.get("body")).toContain("- 系统: Android 16");
    expect(url.searchParams.get("body")).toContain("> 请勿提交隐私信息");
    expect(url.searchParams.get("system-info")).toContain("- 版本号: v0.5.0");
    expect(url.searchParams.get("system-info")).toContain("- 系统: Android 16");
    expect(url.searchParams.get("template")).toBeNull();
  });
});
