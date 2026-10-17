/** Shared optional font catalog. Only metadata ships in clients; files stay on the CDN. */
export const FONT_CATALOG = {
  smiley: { zh: "得意黑", en: "Smiley Sans", posterFamily: "得意黑", labelKey: "editor.imageShare.fontStyles.smiley", family: "EdgeEver Share Smiley", path: "@chinese-fonts/dyh@3.0.0/dist/SmileySans-Oblique/result.css" },
  wenkai: { zh: "霞鹜文楷", en: "LXGW WenKai", posterFamily: "霞鹜文楷", labelKey: "editor.imageShare.fontStyles.wenkai", family: "EdgeEver Share WenKai", path: "@chinese-fonts/lxgwwenkai@3.0.0/dist/LXGWWenKai-Regular/result.css" },
  zhuque: { zh: "朱雀仿宋", en: "Zhuque Fangsong", posterFamily: "朱雀仿宋", labelKey: "editor.imageShare.fontStyles.zhuque", family: "EdgeEver Share Zhuque", path: "@chinese-fonts/zqfs@3.0.0/dist/ZhuqueFangsong-Regular/result.css" },
  heavy: { zh: "思源黑体 Heavy", en: "Noto Sans SC Heavy", posterFamily: "思源黑体 Heavy", labelKey: "editor.imageShare.fontStyles.heavy", family: "EdgeEver Share Noto Heavy", path: "@fontsource/noto-sans-sc@5.3.1/900.css" },
  // Preserve the original containers for fonts whose terms do not permit subsetting.
  puhui: { zh: "普惠体", en: "PuHuiTi", posterFamily: "阿里巴巴普惠体", labelKey: "editor.imageShare.fontStyles.puhui", family: "EdgeEver Share Puhui", path: "@fontpkg/alibaba-pu-hui-ti-3-0@3.1.2/AlibabaPuHuiTi-3-55-Regular.ttf", weight: "400", bytes: 8532824, sha256: "be33bc8d45ced30fa5c542f6f056565baf85003d4e079522110d76016f8a04e2" },
  "puhui-heavy": { zh: "普惠体 Heavy", en: "PuHuiTi Heavy", posterFamily: "阿里巴巴普惠体 Heavy", labelKey: "editor.imageShare.fontStyles.puhuiHeavy", family: "EdgeEver Share Puhui Heavy", path: "@fontpkg/alibaba-pu-hui-ti-3-0@3.1.2/AlibabaPuHuiTi-3-105-Heavy.ttf", weight: "900", bytes: 2536300, sha256: "94cbb24e451a68b44d932d343579fb31571c743df2cfcd144ba60e0a9aa86e64" },
  youshe: { zh: "优设标题黑", en: "YouShe Title", posterFamily: "优设标题黑", labelKey: "editor.imageShare.fontStyles.youshe", family: "EdgeEver Share Youshe", path: "@fontpkg/you-she-biao-ti-hei@1.0.0/%E4%BC%98%E8%AE%BE%E6%A0%87%E9%A2%98%E9%BB%91.ttf", weight: "400", bytes: 1414784, sha256: "dab883d69fb713233ea5d9aff8d1f27ccc2b71e249143edf6ea08367784c5dba" },
  shuhei: { zh: "阿里妈妈数黑体", en: "Alimama ShuHei", posterFamily: "阿里妈妈数黑体", labelKey: "editor.imageShare.fontStyles.shuhei", family: "EdgeEver Share Shuhei", path: "@fontpkg/alimama-shu-hei-ti@1.0.5/AlimamaShuHeiTi-Bold.ttf", weight: "700", bytes: 1360708, sha256: "3ef4ec3f5bac4b71cdee9190aabd5b20995016a59ffee60de87c9a204ac2a684" },
} as const;

/** The five entries in Qiaomu's approximately 15 MB designer starter pack. */
export const NOTE_IMAGE_RECOMMENDED_FONT_IDS = ["puhui", "puhui-heavy", "youshe", "shuhei", "smiley"] as const;

export type RemoteNoteImageFont = keyof typeof FONT_CATALOG;
export const isRemoteNoteImageFont = (value: string): value is RemoteNoteImageFont => Object.hasOwn(FONT_CATALOG, value);

const CDN_ROOTS = ["https://cdn.jsdelivr.net/npm/", "https://unpkg.com/"];

export type RemoteFontSubset = { asset: string; family: string; range: string; weight: string };

/** Parse only font descriptors, never insert third-party styles into the document. */
export const parseRemoteFontCss = (css: string, font: RemoteNoteImageFont): RemoteFontSubset[] => {
  const { path, family } = FONT_CATALOG[font];
  const base = new URL(path, CDN_ROOTS[0]);
  const directory = base.href.slice(0, base.href.lastIndexOf("/") + 1);
  const blocks: RemoteFontSubset[] = [];
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const body = match[1];
    const file = /url\(\s*["']?([^\s"')]+\.woff2)["']?\s*\)/i.exec(body)?.[1];
    const range = /unicode-range\s*:\s*([^;]+)/i.exec(body)?.[1].trim();
    const weight = /font-weight\s*:\s*(\d+(?:\s+\d+)?)/i.exec(body)?.[1];
    if (!file || !range || !weight || !/^U\+[\da-f?]+(?:-[\da-f]+)?(?:\s*,\s*U\+[\da-f?]+(?:-[\da-f]+)?)*$/i.test(range)) continue;
    const url = new URL(file, base);
    // A pinned manifest may only reference WOFF2 files inside its own package directory.
    if (!url.href.startsWith(directory) || url.search || url.hash) continue;
    blocks.push({ asset: url.href, family, range, weight });
  }
  if (!blocks.length) throw new Error("NOTE_IMAGE_FONT_UNAVAILABLE");
  return blocks;
};

/** Mirror paths are equivalent, so both hosts share a single persistent cache key. */
export const remoteFontUrls = (url: string) => {
  if (!url.startsWith(CDN_ROOTS[0])) throw new Error("NOTE_IMAGE_FONT_UNAVAILABLE");
  return CDN_ROOTS.map(root => root + url.slice(CDN_ROOTS[0].length));
};

export const remoteFontCssUrl = (font: RemoteNoteImageFont) => CDN_ROOTS[0] + FONT_CATALOG[font].path;

export const remoteOriginalFont = (font: RemoteNoteImageFont): RemoteFontSubset | undefined => {
  const entry = FONT_CATALOG[font];
  return "weight" in entry
    ? { asset: remoteFontCssUrl(font), family: entry.family, weight: entry.weight, range: "U+0-10FFFF" }
    : undefined;
};

export const remoteFontIntegrity = (url: string) => Object.values(FONT_CATALOG).find(entry => "bytes" in entry && CDN_ROOTS[0] + entry.path === url);

export const FONT_IDS = Object.keys(FONT_CATALOG) as RemoteNoteImageFont[];
export const findCatalogFont = (idOrFamily: string) => FONT_IDS.find(id => id === idOrFamily || FONT_CATALOG[id].family === idOrFamily || FONT_CATALOG[id].posterFamily === idOrFamily);
export const catalogFontStack = (id: RemoteNoteImageFont) => `"${FONT_CATALOG[id].family}", sans-serif`;
export const CATALOG_FONT_STACKS = Object.fromEntries(FONT_IDS.map(id => [id, catalogFontStack(id)])) as Record<RemoteNoteImageFont, string>;
