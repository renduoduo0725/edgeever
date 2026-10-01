export const ATTACHMENT_KINDS = [
  "image",
  "audio",
  "video",
  "pdf",
  "spreadsheet",
  "document",
  "presentation",
  "archive",
  "code",
  "script",
  "text",
  "apk",
  "exe",
  "dmg",
  "linux",
  "executable",
  "book",
  "font",
  "diskimage",
  "database",
  "design",
  "model3d",
  "log",
  "certificate",
  "diagram",
  "file",
] as const;

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

const extensionOf = (filename: string | null | undefined) =>
  filename?.trim().toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1] ?? "";

const AUDIO_MIME_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  aac: "audio/aac",
  aiff: "audio/aiff",
  ape: "audio/x-ape",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  weba: "audio/webm",
  wma: "audio/x-ms-wma",
};

/** Resolve an audio MIME type without overriding a specific type supplied by storage. */
export const resolveAudioMimeType = (
  mimeType: string | null | undefined,
  filename: string | null | undefined,
) => {
  const mime = mimeType?.trim().toLowerCase() ?? "";
  if (mime.startsWith("audio/")) return mime;
  return AUDIO_MIME_TYPES_BY_EXTENSION[extensionOf(filename)] ?? null;
};

const VIDEO_MIME_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  m4v: "video/mp4",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogv: "video/ogg",
  webm: "video/webm",
};

/** Resolve a video MIME type without overriding a specific type supplied by storage. */
export const resolveVideoMimeType = (
  mimeType: string | null | undefined,
  filename: string | null | undefined,
) => {
  const mime = mimeType?.trim().toLowerCase() ?? "";
  if (mime.startsWith("video/")) return mime;
  return VIDEO_MIME_TYPES_BY_EXTENSION[extensionOf(filename)] ?? null;
};

/** Audio or browser-native video MIME used for inline playback and Content-Type. */
export const resolvePlayableMediaMimeType = (
  mimeType: string | null | undefined,
  filename: string | null | undefined,
) => resolveAudioMimeType(mimeType, filename) ?? resolveVideoMimeType(mimeType, filename);

export const resolveAttachmentKind = (
  mimeType: string | null | undefined,
  filename: string | null | undefined,
): AttachmentKind => {
  const mime = mimeType?.trim().toLowerCase() ?? "";
  const extension = extensionOf(filename);

  if (mime.startsWith("image/")) return "image";
  if (resolveAudioMimeType(mime, filename)) return "audio";
  if (resolveVideoMimeType(mime, filename)) return "video";
  if (mime === "application/pdf" || extension === "pdf") return "pdf";

  if (
    mime.includes("spreadsheet") || mime.includes("excel") ||
    ["xls", "xlsx", "xlsm", "ods", "csv"].includes(extension)
  ) return "spreadsheet";

  if (
    mime.includes("word") || mime.includes("wordprocessingml") ||
    ["doc", "docx", "odt", "rtf"].includes(extension)
  ) return "document";

  if (
    mime.includes("presentation") || mime.includes("powerpoint") || mime.includes("keynote") ||
    ["ppt", "pptx", "odp", "keynote"].includes(extension) ||
    (extension === "key" && mime.includes("keynote"))
  ) return "presentation";

  if (
    mime.includes("android.package-archive") ||
    ["apk", "xapk", "apks", "aab"].includes(extension)
  ) return "apk";

  if (
    mime.includes("application/x-msdownload") ||
    mime.includes("application/x-msdos-program") ||
    mime.includes("application/x-msi") ||
    ["exe", "msi"].includes(extension)
  ) return "exe";

  if (
    mime.includes("application/x-apple-diskimage") ||
    ["dmg", "pkg", "ipa"].includes(extension)
  ) return "dmg";

  if (
    mime.includes("application/x-debian-package") ||
    mime.includes("application/x-redhat-package-manager") ||
    ["appimage", "deb", "rpm", "flatpak"].includes(extension)
  ) return "linux";

  if (
    mime.includes("application/x-executable") ||
    ["run", "elf"].includes(extension)
  ) return "executable";

  if (
    mime.includes("epub") || mime.includes("mobipocket") ||
    ["epub", "mobi", "azw", "azw3", "fb2", "djvu"].includes(extension)
  ) return "book";

  if (
    mime.startsWith("font/") || mime.includes("font") ||
    ["ttf", "otf", "woff", "woff2", "eot"].includes(extension)
  ) return "font";

  if (
    mime.includes("iso9660") ||
    ["iso", "img", "vmdk", "qcow2", "vdi"].includes(extension)
  ) return "diskimage";

  if (
    mime.includes("sqlite") ||
    ["sqlite", "sqlite3", "db", "db3"].includes(extension)
  ) return "database";

  if (
    mime.includes("photoshop") ||
    ["psd", "psb", "ai", "sketch", "fig", "xd", "afphoto", "afdesign", "cdr"].includes(extension)
  ) return "design";

  if (
    mime.startsWith("model/") ||
    ["blend", "obj", "stl", "fbx", "gltf", "glb", "step", "stp", "iges", "igs", "dwg", "dxf"].includes(extension)
  ) return "model3d";

  if (
    mime.includes("pkix") || mime.includes("x-x509") || mime.includes("pkcs") ||
    ["pem", "crt", "cer", "key", "pub", "pfx", "p12", "der", "csr"].includes(extension)
  ) return "certificate";

  if (
    ["xmind", "drawio", "excalidraw", "vsdx", "vsd", "mindnode", "mmap"].includes(extension)
  ) return "diagram";

  if (
    ["log", "crash", "out", "trace"].includes(extension)
  ) return "log";

  if (
    ["sh", "bash", "zsh", "fish", "bat", "cmd", "ps1"].includes(extension)
  ) return "script";

  if (
    mime.includes("zip") || mime.includes("compressed") || mime.includes("tar") ||
    mime.includes("rar") || mime.includes("gzip") ||
    ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(extension)
  ) return "archive";

  if (
    mime.includes("javascript") || mime.includes("typescript") || mime.includes("json") ||
    mime.includes("xml") || mime.includes("yaml") ||
    [
      "js", "jsx", "ts", "tsx", "json", "xml", "yaml", "yml", "html", "css", "scss", "less",
      "py", "java", "go", "rs", "c", "cpp", "h", "hpp", "cs",
      "swift", "kt", "kts", "rb", "php", "lua", "sql", "toml", "ini", "conf", "env",
    ].includes(extension)
  ) return "code";

  if (mime.startsWith("text/") || ["txt", "md"].includes(extension)) return "text";
  return "file";
};
