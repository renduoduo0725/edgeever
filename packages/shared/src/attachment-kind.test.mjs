import { describe, expect, test } from "bun:test";
import {
  resolveAttachmentKind,
  resolveAudioMimeType,
  resolvePlayableMediaMimeType,
  resolveVideoMimeType,
} from "./attachment-kind.ts";
import { getAttachmentTypeLabel } from "./attachment-metadata.ts";

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

  test("identifies platform executables, books, fonts, disk images, and databases", () => {
    expect(resolveAttachmentKind("application/vnd.android.package-archive", "app.apk")).toBe("apk");
    expect(resolveAttachmentKind("application/zip", "app.apk")).toBe("apk");
    expect(resolveAttachmentKind(null, "app.aab")).toBe("apk");
    expect(getAttachmentTypeLabel(null, "app.apk")).toBe("APK");
    expect(getAttachmentTypeLabel(null, "app.aab")).toBe("AAB");

    expect(resolveAttachmentKind("application/octet-stream", "EdgeEver-Setup.exe")).toBe("exe");
    expect(resolveAttachmentKind(null, "installer.msi")).toBe("exe");
    expect(getAttachmentTypeLabel(null, "EdgeEver-Setup.exe")).toBe("EXE");
    expect(getAttachmentTypeLabel(null, "installer.msi")).toBe("MSI");

    expect(resolveAttachmentKind(null, "EdgeEver-arm64.dmg")).toBe("dmg");
    expect(resolveAttachmentKind(null, "bundle.pkg")).toBe("dmg");
    expect(resolveAttachmentKind(null, "release.ipa")).toBe("dmg");
    expect(getAttachmentTypeLabel(null, "EdgeEver-arm64.dmg")).toBe("DMG");
    expect(getAttachmentTypeLabel(null, "bundle.pkg")).toBe("PKG");
    expect(getAttachmentTypeLabel(null, "release.ipa")).toBe("IPA");

    expect(resolveAttachmentKind(null, "package.deb")).toBe("linux");
    expect(resolveAttachmentKind(null, "package.rpm")).toBe("linux");
    expect(resolveAttachmentKind(null, "app.AppImage")).toBe("linux");
    expect(getAttachmentTypeLabel(null, "package.deb")).toBe("DEB");
    expect(getAttachmentTypeLabel(null, "package.rpm")).toBe("RPM");
    expect(getAttachmentTypeLabel(null, "app.AppImage")).toBe("APPIMAGE");

    expect(resolveAttachmentKind("application/x-executable", "payload.bin")).toBe("executable");
    expect(getAttachmentTypeLabel("application/x-executable", "payload.bin")).toBe("BIN");

    expect(resolveAttachmentKind("application/epub+zip", "manual.epub")).toBe("book");
    expect(resolveAttachmentKind(null, "novel.mobi")).toBe("book");
    expect(resolveAttachmentKind(null, "guide.azw3")).toBe("book");

    expect(resolveAttachmentKind("font/woff2", "inter.woff2")).toBe("font");
    expect(resolveAttachmentKind(null, "roboto.ttf")).toBe("font");
    expect(resolveAttachmentKind(null, "opensans.otf")).toBe("font");

    expect(resolveAttachmentKind("application/x-iso9660-image", "ubuntu.iso")).toBe("diskimage");
    expect(resolveAttachmentKind(null, "system.img")).toBe("diskimage");

    expect(resolveAttachmentKind(null, "app.sqlite")).toBe("database");
    expect(resolveAttachmentKind(null, "data.db")).toBe("database");

    expect(resolveAttachmentKind(null, "schema.sql")).toBe("code");
    expect(resolveAttachmentKind(null, "Cargo.toml")).toBe("code");
    expect(resolveAttachmentKind(null, "main.rs")).toBe("code");
    expect(resolveAttachmentKind(null, "main.go")).toBe("code");
    expect(resolveAttachmentKind(null, "Main.java")).toBe("code");
    expect(resolveAttachmentKind(null, "script.py")).toBe("code");

    // Scripts
    expect(resolveAttachmentKind(null, "deploy.sh")).toBe("script");
    expect(resolveAttachmentKind(null, "run.bash")).toBe("script");
    expect(resolveAttachmentKind(null, "install.ps1")).toBe("script");
    expect(resolveAttachmentKind(null, "build.bat")).toBe("script");
    expect(getAttachmentTypeLabel(null, "deploy.sh")).toBe("SH");
    expect(getAttachmentTypeLabel(null, "install.ps1")).toBe("PS1");

    // Design
    expect(resolveAttachmentKind(null, "ui.sketch")).toBe("design");
    expect(resolveAttachmentKind(null, "banner.psd")).toBe("design");
    expect(resolveAttachmentKind(null, "icon.ai")).toBe("design");
    expect(resolveAttachmentKind(null, "mockup.fig")).toBe("design");
    expect(getAttachmentTypeLabel(null, "banner.psd")).toBe("PSD");
    expect(getAttachmentTypeLabel(null, "icon.ai")).toBe("AI");
    expect(getAttachmentTypeLabel(null, "mockup.fig")).toBe("FIG");

    // 3D & CAD
    expect(resolveAttachmentKind(null, "character.blend")).toBe("model3d");
    expect(resolveAttachmentKind(null, "part.stl")).toBe("model3d");
    expect(resolveAttachmentKind(null, "mesh.obj")).toBe("model3d");
    expect(resolveAttachmentKind(null, "floorplan.dwg")).toBe("model3d");
    expect(getAttachmentTypeLabel(null, "character.blend")).toBe("BLEND");
    expect(getAttachmentTypeLabel(null, "part.stl")).toBe("STL");

    // Logs
    expect(resolveAttachmentKind(null, "server.log")).toBe("log");
    expect(resolveAttachmentKind(null, "panic.crash")).toBe("log");
    expect(getAttachmentTypeLabel(null, "server.log")).toBe("LOG");

    // Certificates & Keys
    expect(resolveAttachmentKind(null, "cert.pem")).toBe("certificate");
    expect(resolveAttachmentKind(null, "server.crt")).toBe("certificate");
    expect(resolveAttachmentKind(null, "id_rsa.pub")).toBe("certificate");
    expect(resolveAttachmentKind(null, "private.key")).toBe("certificate");
    expect(getAttachmentTypeLabel(null, "cert.pem")).toBe("PEM");
    expect(getAttachmentTypeLabel(null, "id_rsa.pub")).toBe("PUB");

    // Diagrams & Mindmaps
    expect(resolveAttachmentKind(null, "roadmap.xmind")).toBe("diagram");
    expect(resolveAttachmentKind(null, "architecture.drawio")).toBe("diagram");
    expect(resolveAttachmentKind(null, "whiteboard.excalidraw")).toBe("diagram");
    expect(getAttachmentTypeLabel(null, "roadmap.xmind")).toBe("XMIND");
    expect(getAttachmentTypeLabel(null, "architecture.drawio")).toBe("DRAWIO");

    // Common office/data extensions
    expect(getAttachmentTypeLabel(null, "table.csv")).toBe("CSV");
    expect(getAttachmentTypeLabel(null, "README.md")).toBe("MD");
    expect(getAttachmentTypeLabel(null, "notes.txt")).toBe("TXT");
  });

  test("falls back predictably for text and unknown files", () => {
    expect(resolveAttachmentKind("text/plain", "README")).toBe("text");
    expect(resolveAttachmentKind("application/octet-stream", "payload.bin")).toBe("file");
  });
});
