import { resolveAttachmentKind } from "./attachment-kind";

const TYPE_LABELS = {
  image: "IMAGE",
  audio: "AUDIO",
  video: "VIDEO",
  pdf: "PDF",
  spreadsheet: "XLS",
  document: "DOC",
  presentation: "PPT",
  archive: "ZIP",
  code: "CODE",
  script: "SHELL",
  text: "TXT",
  apk: "APK",
  exe: "EXE",
  dmg: "DMG",
  linux: "LINUX",
  executable: "BIN",
  book: "BOOK",
  font: "FONT",
  diskimage: "ISO",
  database: "DB",
  design: "DESIGN",
  model3d: "3D",
  log: "LOG",
  certificate: "KEY",
  diagram: "DIAGRAM",
  file: "FILE",
} as const;

const EXTENSION_LABELS: Readonly<Record<string, string>> = {
  // Installers
  msi: "MSI",
  appimage: "APPIMAGE",
  deb: "DEB",
  rpm: "RPM",
  pkg: "PKG",
  ipa: "IPA",
  aab: "AAB",

  // Design
  psd: "PSD",
  ai: "AI",
  sketch: "SKETCH",
  fig: "FIG",
  xd: "XD",

  // 3D
  stl: "STL",
  obj: "OBJ",
  blend: "BLEND",
  fbx: "FBX",
  gltf: "GLTF",
  glb: "GLB",
  dwg: "DWG",

  // Scripts
  sh: "SH",
  bash: "BASH",
  zsh: "ZSH",
  bat: "BAT",
  cmd: "CMD",
  ps1: "PS1",

  // Certs & Keys
  pem: "PEM",
  crt: "CERT",
  cer: "CERT",
  pub: "PUB",
  key: "KEY",

  // Diagrams
  xmind: "XMIND",
  drawio: "DRAWIO",
  vsdx: "VSDX",

  // Books & Fonts & Media
  epub: "EPUB",
  mobi: "MOBI",
  woff2: "WOFF2",
  woff: "WOFF",
  ttf: "TTF",
  otf: "OTF",

  // Common office/text
  csv: "CSV",
  tsv: "TSV",
  md: "MD",
  "7z": "7Z",
  tar: "TAR",
  gz: "GZ",
};

export const normalizeAttachmentByteSize = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

export const formatAttachmentByteSize = (value: unknown): string | null => {
  const bytes = normalizeAttachmentByteSize(value);
  if (bytes === null) return null;
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / 1024 ** exponent;
  return `${exponent === 0 ? amount.toFixed(0) : amount.toFixed(amount >= 10 ? 1 : 2)} ${units[exponent]}`;
};

export const getAttachmentTypeLabel = (
  mimeType: string | null | undefined,
  filename: string | null | undefined,
) => {
  const extension = filename?.trim().toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1] ?? "";
  if (EXTENSION_LABELS[extension]) {
    return EXTENSION_LABELS[extension];
  }
  return TYPE_LABELS[resolveAttachmentKind(mimeType, filename)];
};

export const formatAttachmentMetadata = (
  mimeType: string | null | undefined,
  filename: string | null | undefined,
  byteSize: unknown,
) => [getAttachmentTypeLabel(mimeType, filename), formatAttachmentByteSize(byteSize)].filter(Boolean).join(" · ");
