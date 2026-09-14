import { describe, expect, test } from "bun:test";
import {
  getAttachmentFilenameFromLabel,
  getResourceIdFromUrl,
  resourceUrlsReferToSameAttachment,
} from "./resource-links.ts";

describe("resource link identity", () => {
  test("extracts resource ids from API and desktop URLs", () => {
    expect(getResourceIdFromUrl("/api/v1/resources/res_123/blob")).toBe("res_123");
    expect(getResourceIdFromUrl("https://notes.example.com/api/v1/resources/res%20one/blob?download=1")).toBe("res one");
    expect(getResourceIdFromUrl("edgeever-resource://resource/res_456")).toBe("res_456");
  });

  test("treats API and desktop URLs for the same resource as one attachment", () => {
    expect(resourceUrlsReferToSameAttachment(
      "edgeever-resource://resource/res_video",
      "/api/v1/resources/res_video/blob",
    )).toBe(true);
    expect(resourceUrlsReferToSameAttachment(
      "/api/v1/resources/res_video/blob",
      "/api/v1/resources/res_other/blob",
    )).toBe(false);
    expect(resourceUrlsReferToSameAttachment("edgeever-staged://stage_1", "edgeever-staged://stage_1")).toBe(true);
    expect(resourceUrlsReferToSameAttachment("edgeever-staged://stage_1", "edgeever-staged://stage_2")).toBe(false);
    expect(resourceUrlsReferToSameAttachment("", "")).toBe(false);
  });

  test("extracts filenames from localized attachment labels", () => {
    expect(getAttachmentFilenameFromLabel("附件：clip.mp4")).toBe("clip.mp4");
    expect(getAttachmentFilenameFromLabel("Attachment: report.pdf")).toBe("report.pdf");
  });
});
