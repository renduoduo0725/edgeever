import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("Xcode Cloud control", () => {
  test("exposes start, wait, and VALID-build resolution for store delivery", () => {
    const script = readFileSync(
      new URL("./xcode-cloud-control.py", import.meta.url),
      "utf8",
    );
    const workflow = readFileSync(
      new URL("../.github/workflows/store-delivery.yml", import.meta.url),
      "utf8",
    );
    const cloudWorkflow = readFileSync(
      new URL("../.github/workflows/ios-xcode-cloud.yml", import.meta.url),
      "utf8",
    );

    expect(script).toContain('sub.add_parser("start"');
    expect(script).toContain('sub.add_parser("wait"');
    expect(script).toContain('sub.add_parser("describe"');
    expect(script).toContain("/issues?limit=50");
    expect(script).toContain("--wait-valid");
    expect(script).toContain("--require-sha");
    expect(script).toContain("sourceBranchOrTag");
    expect(script).toContain("processingState");
    expect(script).toContain('emit("build_number"');
    expect(script).not.toContain("APP_STORE_BUILD_NUMBER: \"49\"");

    expect(workflow).toContain(".edgeever-ci/scripts/xcode-cloud-control.py");
    expect(workflow).toContain("--wait-valid");
    expect(workflow).toContain("git show \"$source_sha:apps/ios/Config/Version.xcconfig\"");

    expect(cloudWorkflow).toContain("scripts/xcode-cloud-control.py");
    expect(cloudWorkflow).toContain("describe");
    expect(cloudWorkflow).not.toContain("submit-review");
    expect(cloudWorkflow).not.toContain('APP_STORE_BUILD_NUMBER: "49"');
  });

  test("keeps iOS marketing version in Version.xcconfig instead of project.yml", () => {
    const projectYml = readFileSync(
      new URL("../apps/ios/project.yml", import.meta.url),
      "utf8",
    );
    const preXcodebuild = readFileSync(
      new URL("../apps/ios/ci_scripts/ci_pre_xcodebuild.sh", import.meta.url),
      "utf8",
    );
    const pbxproj = readFileSync(
      new URL("../apps/ios/EdgeEver.xcodeproj/project.pbxproj", import.meta.url),
      "utf8",
    );
    const xcconfig = readFileSync(
      new URL("../apps/ios/Config/Version.xcconfig", import.meta.url),
      "utf8",
    );
    const marketing = xcconfig.match(/^MARKETING_VERSION\s*=\s*(\S+)/m)?.[1];

    expect(projectYml).not.toMatch(/MARKETING_VERSION\s*:/);
    expect(preXcodebuild).toContain("Stamped MARKETING_VERSION=");
    expect(marketing).toBeTruthy();
    expect(pbxproj).not.toContain("MARKETING_VERSION = 1.74.0;");
    expect(pbxproj).toContain(`MARKETING_VERSION = ${marketing};`);
  });
});
