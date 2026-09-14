import { describe, expect, test } from "bun:test";
import {
  resolveAttachmentKind,
  resolveAudioMimeType,
  resolvePlayableMediaMimeType,
  resolveVideoMimeType,
} from "./attachment-kind.ts";

describe("attachment kind", () => {
  test("uses MIME types for media and filenames for common documents", () => {
    expect(resolveAttachmentKind("audio/mpeg", "recording.bin")).toBe("audio");
    expect(resolveAttachmentKind("application/octet-stream", "recording.FLAC")).toBe("audio");
    expect(resolveAttachmentKind(null, "archive.ape")).toBe("audio");
    expect(resolveAttachmentKind("video/mp4", "clip.bin")).toBe("video");
    expect(resolveAttachmentKind("application/octet-stream", "demo.MP4")).toBe("video");
    expect(resolveAttachmentKind(null, "screen.mov")).toBe("video");
    expect(resolveAttachmentKind(null, "report.PDF")).toBe("pdf");
    expect(resolveAttachmentKind(null, "budget.xlsx")).toBe("spreadsheet");
    expect(resolveAttachmentKind(null, "proposal.docx")).toBe("document");
    expect(resolveAttachmentKind(null, "pitch.pptx")).toBe("presentation");
    expect(resolveAttachmentKind(null, "source.ts")).toBe("code");
    expect(resolveAttachmentKind(null, "backup.7z")).toBe("archive");
  });

  test("normalizes common audio MIME types from filenames", () => {
    expect(resolveAudioMimeType("application/octet-stream", "voice.mp3")).toBe("audio/mpeg");
    expect(resolveAudioMimeType("", "lossless.flac")).toBe("audio/flac");
    expect(resolveAudioMimeType("audio/x-custom", "voice.mp3")).toBe("audio/x-custom");
    expect(resolveAudioMimeType("application/octet-stream", "payload.bin")).toBeNull();
  });

  test("normalizes browser-native video MIME types from filenames", () => {
    expect(resolveVideoMimeType("application/octet-stream", "clip.mp4")).toBe("video/mp4");
    expect(resolveVideoMimeType("", "walkthrough.webm")).toBe("video/webm");
    expect(resolveVideoMimeType("", "screen.MOV")).toBe("video/quicktime");
    expect(resolveVideoMimeType("video/quicktime", "clip.mp4")).toBe("video/quicktime");
    expect(resolveVideoMimeType("application/octet-stream", "payload.bin")).toBeNull();
    expect(resolveVideoMimeType("application/octet-stream", "movie.mkv")).toBeNull();
    expect(resolveAttachmentKind("application/octet-stream", "movie.mkv")).toBe("file");
    expect(resolveAttachmentKind("video/x-matroska", "movie.mkv")).toBe("video");
    expect(resolvePlayableMediaMimeType("application/octet-stream", "demo.mp4")).toBe("video/mp4");
    expect(resolvePlayableMediaMimeType("application/octet-stream", "voice.mp3")).toBe("audio/mpeg");
  });

  test("falls back predictably for text and unknown files", () => {
    expect(resolveAttachmentKind("text/plain", "README")).toBe("text");
    expect(resolveAttachmentKind("application/octet-stream", "payload.bin")).toBe("file");
  });
});
