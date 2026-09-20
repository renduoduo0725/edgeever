import { describe, expect, test } from "bun:test";
import {
  buildStagedResourceUrlRewrites,
  collectStagedResourceReferences,
  contentReferencesStagedResourceUrl,
  findMatchingMemoResource,
  repairMemoStagedResourceUrls,
  stagedResourceIdFromUrl,
} from "./staged-resource-repair.ts";

const screenshotResource = {
  url: "/api/v1/resources/res_shot/blob",
  filename: "screenshot-20260918-225321.webp",
  kind: "image",
};

describe("staged resource repair", () => {
  test("reads the staged id from desktop placeholder URLs", () => {
    expect(stagedResourceIdFromUrl("edgeever-staged://stage_1")).toBe("stage_1");
    expect(stagedResourceIdFromUrl("/api/v1/resources/res_shot/blob")).toBeNull();
  });

  test("collects image alt text as the filename for a staged screenshot", () => {
    expect(collectStagedResourceReferences({
      contentJson: {
        type: "doc",
        content: [{
          type: "image",
          attrs: {
            alt: "screenshot-20260918-225321.webp",
            src: "edgeever-staged://stage_1789743202770_hu8zo7lrxco",
          },
        }],
      },
      contentMarkdown: "![screenshot-20260918-225321.webp](edgeever-staged://stage_1789743202770_hu8zo7lrxco)\n\n",
    })).toEqual([{
      stagedId: "stage_1789743202770_hu8zo7lrxco",
      filename: "screenshot-20260918-225321.webp",
    }]);
  });

  test("rewrites a dead screenshot placeholder to the memo's uploaded image", () => {
    const memo = {
      contentJson: {
        type: "doc",
        content: [{
          type: "image",
          attrs: {
            alt: "screenshot-20260918-225321.webp",
            src: "edgeever-staged://stage_dead",
            width: 50,
          },
        }, { type: "paragraph" }],
      },
      contentMarkdown: "![screenshot-20260918-225321.webp](edgeever-staged://stage_dead)\n\n",
    };

    expect(repairMemoStagedResourceUrls(memo, [screenshotResource])).toEqual({
      contentJson: {
        type: "doc",
        content: [{
          type: "image",
          attrs: {
            alt: "screenshot-20260918-225321.webp",
            src: screenshotResource.url,
            width: 50,
          },
        }, { type: "paragraph" }],
      },
      contentMarkdown: `![screenshot-20260918-225321.webp](${screenshotResource.url})\n\n`,
    });
  });

  test("keeps a staged URL while the local staging file is still present", () => {
    const memo = {
      contentMarkdown: "![screenshot.webp](edgeever-staged://stage_live)",
    };
    expect(repairMemoStagedResourceUrls(memo, [screenshotResource], new Set(["stage_live"])))
      .toEqual(memo);
    expect(buildStagedResourceUrlRewrites(memo, [screenshotResource], new Set(["stage_live"])))
      .toEqual([]);
  });

  test("does not guess when a memo has several images and the placeholder has no filename", () => {
    expect(findMatchingMemoResource([
      screenshotResource,
      { url: "/api/v1/resources/res_other/blob", filename: "other.webp", kind: "image" },
    ], null, "image")).toBeNull();
    expect(contentReferencesStagedResourceUrl("no images here")).toBe(false);
  });

  test("does not consume a longer staged id that only shares a prefix", () => {
    const memo = {
      contentMarkdown: "![one](edgeever-staged://stage_1) ![ten](edgeever-staged://stage_10)",
    };
    expect(repairMemoStagedResourceUrls(memo, [{
      url: "/api/v1/resources/res_one/blob",
      filename: "one",
      kind: "image",
    }]).contentMarkdown).toBe("![one](/api/v1/resources/res_one/blob) ![ten](edgeever-staged://stage_10)");
  });
});
