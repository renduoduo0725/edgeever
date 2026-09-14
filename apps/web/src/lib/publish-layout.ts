import {
  PUBLISH_LAYOUT_ORNAMENTS,
  publishOrnamentCssVars,
  publishOrnamentDataUri,
  type PublishOrnamentId,
} from "./publish-ornaments";

export const PAPER_EDITOR_THEME_IDS = [
  "letter",
  "guide",
  "blueprint",
  "journal",
  "stance",
  "stub",
  "brief",
  "outline",
  "zen",
  "grove",
] as const;
export type PublishLayoutId = (typeof PAPER_EDITOR_THEME_IDS)[number];
export const PUBLISH_LAYOUT_IDS = PAPER_EDITOR_THEME_IDS;

export const PUBLISH_PALETTE_IDS = [
  "emerald",
  "ink",
  "dawn",
  "clay",
  "navy",
  "slate",
  "plum",
  "forest",
  "azure",
  "amber",
  "teal",
  "violet",
  "mist",
] as const;
export type PublishPaletteId = (typeof PUBLISH_PALETTE_IDS)[number];

export const DEFAULT_PUBLISH_LAYOUT: PublishLayoutId = "letter";
export const DEFAULT_PUBLISH_PALETTE: PublishPaletteId = "emerald";

export const PAPER_EDITOR_THEME_PALETTES = {
  letter: "dawn",
  guide: "azure",
  blueprint: "navy",
  journal: "slate",
  stance: "clay",
  stub: "amber",
  brief: "teal",
  outline: "violet",
  zen: "mist",
  grove: "forest",
} as const satisfies Record<PublishLayoutId, PublishPaletteId>;

export const isPaperEditorTheme = (value: string | null | undefined): value is PublishLayoutId =>
  Boolean(value && (PAPER_EDITOR_THEME_IDS as readonly string[]).includes(value));

export const resolvePaperEditorTheme = (theme: string | null | undefined) => {
  if (!isPaperEditorTheme(theme)) return null;
  return { layout: theme, palette: PAPER_EDITOR_THEME_PALETTES[theme] };
};

export const PUBLISH_LAYOUT_STORAGE_KEY = "edgeever.publish-layout";
export const PUBLISH_PALETTE_STORAGE_KEY = "edgeever.publish-palette";
export const PUBLISH_LAYOUT_CHANGED_EVENT = "edgeever:publish-layout-changed";

export type PublishPalette = {
  id: PublishPaletteId;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentGrid: string;
  text: string;
  textStrong: string;
  textMuted: string;
  surface: string;
  divider: string;
  link: string;
  codeBg: string;
  codeText: string;
  bg: string;
};

const palette = (
  id: PublishPaletteId,
  colors: Omit<PublishPalette, "id">,
): PublishPalette => ({ id, ...colors });

export const PUBLISH_PALETTES: Record<PublishPaletteId, PublishPalette> = {
  emerald: palette("emerald", {
    accent: "#16A06E",
    accentSoft: "#E8F6F0",
    accentBorder: "#B7E0CC",
    accentGrid: "rgba(22,160,110,0.14)",
    text: "#2C3A34",
    textStrong: "#14241C",
    textMuted: "#5C6F66",
    surface: "#F4FBF7",
    divider: "#D7EBE1",
    link: "#0F7A54",
    codeBg: "#F3F7F5",
    codeText: "#0F7A54",
    bg: "#FFFFFF",
  }),
  ink: palette("ink", {
    accent: "#1A5C4A",
    accentSoft: "#E7F2EE",
    accentBorder: "#B5D2C8",
    accentGrid: "rgba(26,92,74,0.14)",
    text: "#24332E",
    textStrong: "#12201B",
    textMuted: "#5A6C65",
    surface: "#F3F8F6",
    divider: "#D3E3DD",
    link: "#164C3E",
    codeBg: "#EEF4F1",
    codeText: "#164C3E",
    bg: "#FFFFFF",
  }),
  dawn: palette("dawn", {
    accent: "#D9A521",
    accentSoft: "#FFF7DF",
    accentBorder: "#EAD89F",
    accentGrid: "rgba(217,165,33,0.14)",
    text: "#3D2A1B",
    textStrong: "#3A3020",
    textMuted: "#74613C",
    surface: "#FFFDF8",
    divider: "#F0E3BD",
    link: "#7C5500",
    codeBg: "#FFFAF0",
    codeText: "#7C5500",
    bg: "#FFFFFF",
  }),
  clay: palette("clay", {
    accent: "#E02D32",
    accentSoft: "#FFF1F1",
    accentBorder: "#FFC2C2",
    accentGrid: "rgba(224,45,50,0.14)",
    text: "#374151",
    textStrong: "#1C1917",
    textMuted: "#374151",
    surface: "#FFF7F7",
    divider: "#FFD6D6",
    link: "#B42318",
    codeBg: "#FFF1F1",
    codeText: "#B42318",
    bg: "#FFFFFF",
  }),
  navy: palette("navy", {
    accent: "#4271B3",
    accentSoft: "#F3F4F7",
    accentBorder: "#C8D0DB",
    accentGrid: "rgba(66,113,179,0.14)",
    text: "#3D4650",
    textStrong: "#272D35",
    textMuted: "#495464",
    surface: "#F9FAFA",
    divider: "#D7DDE5",
    link: "#2F578A",
    codeBg: "#EEF3F8",
    codeText: "#2F578A",
    bg: "#FFFFFF",
  }),
  slate: palette("slate", {
    accent: "#89798B",
    accentSoft: "#F5F4F6",
    accentBorder: "#D4CDD5",
    accentGrid: "rgba(137,121,139,0.14)",
    text: "#5C505E",
    textStrong: "#312A32",
    textMuted: "#5C505E",
    surface: "#FAFAFA",
    divider: "#E0DBE1",
    link: "#6B5C6D",
    codeBg: "#F5F4F6",
    codeText: "#6B5C6D",
    bg: "#FFFFFF",
  }),
  plum: palette("plum", {
    accent: "#7A4E6E",
    accentSoft: "#F5EEF3",
    accentBorder: "#D4BCCB",
    accentGrid: "rgba(122,78,110,0.14)",
    text: "#3A2E36",
    textStrong: "#241820",
    textMuted: "#746068",
    surface: "#FBF7F9",
    divider: "#E8D7E0",
    link: "#5E3A54",
    codeBg: "#F4ECF1",
    codeText: "#5E3A54",
    bg: "#FFFFFF",
  }),
  forest: palette("forest", {
    accent: "#4D9D7F",
    accentSoft: "#F3F6F5",
    accentBorder: "#CAD8D3",
    accentGrid: "rgba(77,157,127,0.14)",
    text: "#4D6159",
    textStrong: "#29332F",
    textMuted: "#4D6159",
    surface: "#FAFAFA",
    divider: "#D9E3DF",
    link: "#3B7A62",
    codeBg: "#F3F6F5",
    codeText: "#3B7A62",
    bg: "#FFFFFF",
  }),
  azure: palette("azure", {
    accent: "#2F80ED",
    accentSoft: "#EEF6FF",
    accentBorder: "#B9D7FF",
    accentGrid: "rgba(47,128,237,0.14)",
    text: "#374151",
    textStrong: "#111827",
    textMuted: "#4B5563",
    surface: "#F5F8FC",
    divider: "#D7E8FF",
    link: "#1D64C7",
    codeBg: "#EEF6FF",
    codeText: "#1D64C7",
    bg: "#FFFFFF",
  }),
  amber: palette("amber", {
    accent: "#E3A321",
    accentSoft: "#FFF8E8",
    accentBorder: "#F4D58B",
    accentGrid: "rgba(227,163,33,0.14)",
    text: "#555555",
    textStrong: "#1A1A1A",
    textMuted: "#555555",
    surface: "#FFFEF8",
    divider: "#F7E3B4",
    link: "#B07C12",
    codeBg: "#FFF8E8",
    codeText: "#B07C12",
    bg: "#FFFFFF",
  }),
  teal: palette("teal", {
    accent: "#22B8A7",
    accentSoft: "#ECFBF8",
    accentBorder: "#A8E5DD",
    accentGrid: "rgba(34,184,167,0.14)",
    text: "#4D4F46",
    textStrong: "#23251D",
    textMuted: "#4D4F46",
    surface: "#EEEFE9",
    divider: "#CDEFEA",
    link: "#1A8F82",
    codeBg: "#ECFBF8",
    codeText: "#1A8F82",
    bg: "#FFFFFF",
  }),
  violet: palette("violet", {
    accent: "#7567F8",
    accentSoft: "#F3F1FF",
    accentBorder: "#CFC9FF",
    accentGrid: "rgba(117,103,248,0.14)",
    text: "#3F3F46",
    textStrong: "#18181B",
    textMuted: "#3F3F46",
    surface: "#F4F4F5",
    divider: "#E1DEFF",
    link: "#5B4EE0",
    codeBg: "#F3F1FF",
    codeText: "#5B4EE0",
    bg: "#FFFFFF",
  }),
  mist: palette("mist", {
    accent: "#35A7B8",
    accentSoft: "#EEF9FA",
    accentBorder: "#B7E3E8",
    accentGrid: "rgba(53,167,184,0.14)",
    text: "#525252",
    textStrong: "#26352D",
    textMuted: "#526359",
    surface: "#F7FAFA",
    divider: "#D4EEF1",
    link: "#2A8492",
    codeBg: "#EEF9FA",
    codeText: "#2A8492",
    bg: "#FFFFFF",
  }),
};

export const isPublishLayoutId = (value: string | null | undefined): value is PublishLayoutId =>
  Boolean(value && (PUBLISH_LAYOUT_IDS as readonly string[]).includes(value));

export const isPublishPaletteId = (value: string | null | undefined): value is PublishPaletteId =>
  Boolean(value && (PUBLISH_PALETTE_IDS as readonly string[]).includes(value));

export const resolveStoredPublishLayout = (stored: string | null): PublishLayoutId =>
  isPublishLayoutId(stored) ? stored : DEFAULT_PUBLISH_LAYOUT;

export const resolveStoredPublishPalette = (stored: string | null): PublishPaletteId =>
  isPublishPaletteId(stored) ? stored : DEFAULT_PUBLISH_PALETTE;

const readStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Private mode / blocked storage — preference stays session-only via the event.
  }
};

export const readPublishLayoutPreference = (): PublishLayoutId =>
  resolveStoredPublishLayout(readStorage(PUBLISH_LAYOUT_STORAGE_KEY));

export const readPublishPalettePreference = (): PublishPaletteId =>
  resolveStoredPublishPalette(readStorage(PUBLISH_PALETTE_STORAGE_KEY));

const notifyPublishLayoutChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PUBLISH_LAYOUT_CHANGED_EVENT));
};

export const writePublishLayoutPreference = (layout: PublishLayoutId) => {
  writeStorage(PUBLISH_LAYOUT_STORAGE_KEY, layout);
  notifyPublishLayoutChanged();
};

export const writePublishPalettePreference = (palette: PublishPaletteId) => {
  writeStorage(PUBLISH_PALETTE_STORAGE_KEY, palette);
  notifyPublishLayoutChanged();
};

export const formatChapterIndex = (index: number) => String(index + 1).padStart(2, "0");

export type PublishHeadingKind = "title" | "chapter" | "small" | "none";
export type PublishChapterStyle =
  | "none"
  | "aside-serif"
  | "aside-part"
  | "badge"
  | "badge-section"
  | "stacked-section"
  | "kicker"
  | "issue";
export type PublishQuoteStyle =
  | "grid-card"
  | "rule"
  | "panel"
  | "marks"
  | "rule-thick"
  | "banner"
  | "labeled"
  | "italic-center"
  | "italic-rule";
export type PublishSmallHeadingStyle = "bookmark" | "slash" | "bar" | "dash" | "plain";
export type PublishTitleRule = "none" | "short" | "brush";

export type PublishLayoutChrome = {
  kicker: string | null;
  h1Align: "left" | "center";
  h1Rule: PublishTitleRule;
  h1Vol: boolean;
  chapter: PublishChapterStyle;
  small: PublishSmallHeadingStyle;
  quote: PublishQuoteStyle;
  quoteBanner?: string;
  strongAccent: boolean;
};

export const PUBLISH_LAYOUT_CHROME: Record<PublishLayoutId, PublishLayoutChrome> = {
  letter: {
    kicker: null,
    h1Align: "center",
    h1Rule: "brush",
    h1Vol: false,
    chapter: "aside-serif",
    small: "bookmark",
    quote: "grid-card",
    strongAccent: true,
  },
  guide: {
    kicker: "GUIDE · ARTICLE",
    h1Align: "left",
    h1Rule: "short",
    h1Vol: false,
    chapter: "aside-part",
    small: "plain",
    quote: "rule",
    strongAccent: true,
  },
  blueprint: {
    kicker: null,
    h1Align: "left",
    h1Rule: "short",
    h1Vol: true,
    chapter: "none",
    small: "bookmark",
    quote: "panel",
    strongAccent: true,
  },
  journal: {
    kicker: null,
    h1Align: "left",
    h1Rule: "short",
    h1Vol: true,
    chapter: "issue",
    small: "dash",
    quote: "italic-rule",
    strongAccent: true,
  },
  stance: {
    kicker: "ARTICLE",
    h1Align: "left",
    h1Rule: "none",
    h1Vol: false,
    chapter: "badge-section",
    small: "bar",
    quote: "marks",
    strongAccent: true,
  },
  stub: {
    kicker: "EDITION · FIELD NOTES",
    h1Align: "left",
    h1Rule: "short",
    h1Vol: false,
    chapter: "badge",
    small: "bar",
    quote: "rule-thick",
    strongAccent: false,
  },
  brief: {
    kicker: "EDITION · FIELD NOTES",
    h1Align: "left",
    h1Rule: "none",
    h1Vol: false,
    chapter: "aside-part",
    small: "plain",
    quote: "banner",
    quoteBanner: "EDITOR'S NOTE",
    strongAccent: true,
  },
  outline: {
    kicker: "MINIMAL · ARTICLE",
    h1Align: "left",
    h1Rule: "none",
    h1Vol: false,
    chapter: "stacked-section",
    small: "plain",
    quote: "labeled",
    quoteBanner: "QUOTE",
    strongAccent: false,
  },
  zen: {
    kicker: "FIELD NOTES",
    h1Align: "left",
    h1Rule: "short",
    h1Vol: false,
    chapter: "kicker",
    small: "bar",
    quote: "italic-center",
    strongAccent: false,
  },
  grove: {
    kicker: null,
    h1Align: "left",
    h1Rule: "none",
    h1Vol: false,
    chapter: "none",
    small: "slash",
    quote: "marks",
    strongAccent: true,
  },
};

export const planHeadingDecoration = (
  tag: string,
  layout: PublishLayoutId,
  chapterIndex: number,
): { kind: PublishHeadingKind; chapterLabel?: string } => {
  if (tag === "h1") return { kind: "title" };
  if (tag === "h3") return { kind: "small" };
  if (tag === "h2" && PUBLISH_LAYOUT_CHROME[layout].chapter !== "none") {
    return { kind: "chapter", chapterLabel: formatChapterIndex(chapterIndex) };
  }
  return { kind: "none" };
};

export type PublishSurface = "desktop" | "phone";

export type PublishRhythm = {
  fontSize: string;
  lineHeight: string;
  paragraphSpacing: string;
  letterSpacing: string;
  headingLetterSpacing: string;
  headingAlign: "left" | "center";
};

export const PHONE_ARTICLE_RHYTHM = {
  h1Size: "24px",
  h2Size: "20px",
  h3Size: "15px",
} as const;

const resolvePublishRhythm = (layout: PublishLayoutId, _surface: PublishSurface): PublishRhythm =>
  PUBLISH_LAYOUT_RHYTHM[layout];

export const PUBLISH_LAYOUT_RHYTHM: Record<PublishLayoutId, PublishRhythm> = {
  letter: {
    fontSize: "15px",
    lineHeight: "2",
    paragraphSpacing: "28px",
    letterSpacing: "0.06em",
    headingLetterSpacing: "0.08em",
    headingAlign: "center",
  },
  guide: {
    fontSize: "15px",
    lineHeight: "1.72",
    paragraphSpacing: "14px",
    letterSpacing: "0.01em",
    headingLetterSpacing: "0.02em",
    headingAlign: "left",
  },
  blueprint: {
    fontSize: "16px",
    lineHeight: "1.78",
    paragraphSpacing: "18px",
    letterSpacing: "0.02em",
    headingLetterSpacing: "0.04em",
    headingAlign: "left",
  },
  journal: {
    fontSize: "16px",
    lineHeight: "1.95",
    paragraphSpacing: "28px",
    letterSpacing: "0.04em",
    headingLetterSpacing: "0.06em",
    headingAlign: "left",
  },
  stance: {
    fontSize: "16px",
    lineHeight: "1.68",
    paragraphSpacing: "16px",
    letterSpacing: "0em",
    headingLetterSpacing: "0.01em",
    headingAlign: "left",
  },
  stub: {
    fontSize: "15px",
    lineHeight: "1.88",
    paragraphSpacing: "30px",
    letterSpacing: "0.08em",
    headingLetterSpacing: "0.14em",
    headingAlign: "left",
  },
  brief: {
    fontSize: "15px",
    lineHeight: "1.82",
    paragraphSpacing: "22px",
    letterSpacing: "0.03em",
    headingLetterSpacing: "0.05em",
    headingAlign: "left",
  },
  outline: {
    fontSize: "16px",
    lineHeight: "1.76",
    paragraphSpacing: "20px",
    letterSpacing: "0.05em",
    headingLetterSpacing: "0.1em",
    headingAlign: "left",
  },
  zen: {
    fontSize: "16px",
    lineHeight: "2.2",
    paragraphSpacing: "36px",
    letterSpacing: "0.1em",
    headingLetterSpacing: "0.12em",
    headingAlign: "left",
  },
  grove: {
    fontSize: "15px",
    lineHeight: "1.98",
    paragraphSpacing: "26px",
    letterSpacing: "0.045em",
    headingLetterSpacing: "0.06em",
    headingAlign: "left",
  },
};

const hexToRgbChannels = (hex: string) => {
  const value = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return "22 160 110";
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(" ");
};

export const publishColorCssVars = (
  palette: PublishPalette,
  host: "editor" | "article" = "editor",
): Record<string, string> => ({
  "--publish-accent": palette.accent,
  "--publish-accent-soft": palette.accentSoft,
  "--publish-accent-border": palette.accentBorder,
  "--publish-accent-grid": palette.accentGrid,
  "--publish-text": palette.text,
  "--publish-text-strong": palette.textStrong,
  "--publish-text-muted": palette.textMuted,
  "--publish-surface": palette.surface,
  "--publish-divider": palette.divider,
  "--publish-link": palette.link,
  "--publish-code-bg": palette.codeBg,
  "--publish-code-text": palette.codeText,
  "--publish-bg": palette.bg,
  "--brand-green-rgb": hexToRgbChannels(palette.accent),
  "--brand-green-hover-rgb": hexToRgbChannels(palette.link),
  "--brand-green-200-rgb": hexToRgbChannels(palette.accentBorder),
  "--brand-green-300-rgb": hexToRgbChannels(palette.accent),
  "--brand-green-600-rgb": hexToRgbChannels(palette.link),
  "--memo-content-divider-color": palette.accentBorder,
  ...(host === "article"
    ? {
        "--brand-green": palette.accent,
        "--brand-green-hover": palette.link,
        "--brand-green-muted": palette.accentSoft,
        "--brand-green-soft": palette.surface,
        "--brand-green-border": palette.accentBorder,
        "--brand-green-text": palette.link,
      }
    : {}),
});

export const publishEditorCssVars = (
  layout: PublishLayoutId,
  paletteId: PublishPaletteId,
  surface: PublishSurface = "desktop",
): Record<string, string> => {
  const rhythm = resolvePublishRhythm(layout, surface);
  const palette = PUBLISH_PALETTES[paletteId] ?? PUBLISH_PALETTES[DEFAULT_PUBLISH_PALETTE];
  return {
    "--editor-body-font-size": rhythm.fontSize,
    "--editor-body-line-height": rhythm.lineHeight,
    "--editor-paragraph-spacing": rhythm.paragraphSpacing,
    "--editor-letter-spacing": rhythm.letterSpacing,
    "--editor-heading-letter-spacing": rhythm.headingLetterSpacing,
    ...publishColorCssVars(palette),
    ...publishOrnamentCssVars(),
  };
};

const css = (declarations: Record<string, string | undefined>) =>
  Object.entries(declarations)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

export type PublishTagStyles = Record<string, string>;

const quoteStyleRules = (
  layout: PublishLayoutId,
  palette: PublishPalette,
  phone: boolean,
): Record<string, string> => {
  const chrome = PUBLISH_LAYOUT_CHROME[layout];
  const bottom = phone ? "14px" : "28px";
  const pad = phone ? "10px 12px" : "16px 18px";
  switch (chrome.quote) {
    case "grid-card":
      return {
        margin: `0 0 ${bottom}`,
        padding: phone ? "14px 14px 16px 18px" : "18px 16px 20px 22px",
        border: `1px solid ${palette.accentBorder}`,
        "border-radius": "18px",
        "background-color": palette.surface,
        "background-image": `linear-gradient(to right, ${palette.accentGrid} 1px, transparent 1px), linear-gradient(to bottom, ${palette.accentGrid} 1px, transparent 1px)`,
        "background-size": "30px 30px",
        color: palette.textMuted,
      };
    case "panel":
      return {
        margin: `0 0 ${bottom}`,
        padding: pad,
        border: `1px solid ${palette.accentBorder}`,
        "border-radius": "10px",
        background: palette.surface,
        color: palette.textMuted,
      };
    case "marks":
      return {
        margin: `0 0 ${bottom}`,
        padding: phone ? "12px 14px 14px" : "16px 18px 18px",
        border: `1px solid ${palette.accentBorder}`,
        "border-radius": "12px",
        background: palette.accentSoft,
        color: palette.textMuted,
      };
    case "rule-thick":
      return {
        margin: `0 0 ${bottom}`,
        padding: phone ? "8px 0 8px 14px" : "6px 0 6px 16px",
        "border-left": `4px solid ${palette.accent}`,
        background: "transparent",
        color: palette.textMuted,
      };
    case "banner":
      return {
        margin: "0",
        padding: phone ? "12px 14px 14px" : "14px 16px 16px",
        border: "0",
        background: palette.accentSoft,
        color: palette.textMuted,
      };
    case "labeled":
      return {
        margin: `0 0 ${bottom}`,
        padding: "0",
        border: "0",
        background: "transparent",
        color: palette.textStrong,
        "text-align": "center",
        "font-weight": "600",
      };
    case "italic-center":
      return {
        margin: `0 0 ${bottom}`,
        padding: phone ? "4px 8px" : "4px 24px",
        border: "0",
        background: "transparent",
        color: palette.textMuted,
        "font-style": "italic",
        "text-align": "center",
      };
    case "italic-rule":
      return {
        margin: `0 0 ${bottom}`,
        padding: phone ? "12px 4px" : "18px 8px",
        "border-top": `1px solid ${palette.accentBorder}`,
        "border-bottom": `1px solid ${palette.accentBorder}`,
        background: palette.surface,
        color: palette.textMuted,
        "font-style": "italic",
      };
    case "rule":
    default:
      return {
        margin: `0 0 ${bottom}`,
        padding: phone ? "4px 0 4px 12px" : "4px 0 4px 16px",
        "border-left": `3px solid ${palette.accent}`,
        background: "transparent",
        color: palette.textMuted,
      };
  }
};

export const buildPublishStyles = (
  layout: PublishLayoutId,
  palette: PublishPalette,
  surface: PublishSurface = "desktop",
): PublishTagStyles => {
  const rhythm = resolvePublishRhythm(layout, surface);
  const phone = surface === "phone";
  const chrome = PUBLISH_LAYOUT_CHROME[layout];
  const h1Weight = layout === "letter" || layout === "guide" || layout === "stance" ? "800" : "700";
  const h2Rules =
    layout === "blueprint"
      ? { "border-left": `3px solid ${palette.accent}`, "padding-left": "12px" }
      : layout === "grove"
        ? { "display": "inline-block", "border-bottom": `2px solid ${palette.accent}`, "padding-bottom": "6px" }
        : {};
  const h3Rules =
    chrome.small === "bookmark"
      ? { "text-align": "center" }
      : chrome.small === "bar"
        ? { "border-left": `3px solid ${palette.accent}`, "padding-left": "10px" }
        : chrome.small === "slash"
          ? { "text-align": "center", color: palette.accent }
          : {};
  const quote = quoteStyleRules(layout, palette, phone);

  return {
    root: css({
      "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      "font-size": rhythm.fontSize,
      "line-height": rhythm.lineHeight,
      "letter-spacing": rhythm.letterSpacing,
      color: palette.text,
      "background-color": palette.bg,
      "word-break": "break-word",
    }),
    p: css({
      margin: `0 0 ${rhythm.paragraphSpacing}`,
      padding: "0",
      "line-height": rhythm.lineHeight,
      "letter-spacing": rhythm.letterSpacing,
      "font-size": rhythm.fontSize,
      color: palette.text,
    }),
    h1: css({
      "text-align": chrome.h1Align,
      margin: phone ? "0 0 12px" : "0 0 18px",
      "font-size": phone
        ? PHONE_ARTICLE_RHYTHM.h1Size
        : layout === "journal" || layout === "zen"
          ? "26px"
          : "24px",
      "line-height": phone ? "1.4" : "1.35",
      "letter-spacing": rhythm.headingLetterSpacing,
      "font-weight": h1Weight,
      color: palette.textStrong,
    }),
    h2: css({
      margin: phone ? "18px 0 10px" : "28px 0 16px",
      "font-size": phone ? PHONE_ARTICLE_RHYTHM.h2Size : "20px",
      "line-height": "1.35",
      "letter-spacing": rhythm.headingLetterSpacing,
      "font-weight": phone ? "600" : "700",
      color: palette.textStrong,
      "text-align": "left",
      ...h2Rules,
    }),
    h3: css({
      margin: phone ? "14px 0 8px" : "24px 0 12px",
      "font-size": phone ? PHONE_ARTICLE_RHYTHM.h3Size : layout === "letter" ? "15px" : "16px",
      "line-height": "1.45",
      "letter-spacing": rhythm.headingLetterSpacing,
      "font-weight": "700",
      color: chrome.small === "slash" ? palette.accent : palette.textStrong,
      ...h3Rules,
    }),
    blockquote: css({
      "line-height": rhythm.lineHeight,
      "letter-spacing": rhythm.letterSpacing,
      ...quote,
    }),
    ul: css({
      margin: "0 0 1em",
      "padding-left": "1.6em",
      "line-height": rhythm.lineHeight,
      "letter-spacing": rhythm.letterSpacing,
      color: palette.text,
    }),
    ol: css({
      margin: "0 0 1em",
      "padding-left": "1.6em",
      "letter-spacing": rhythm.letterSpacing,
      "line-height": rhythm.lineHeight,
      color: palette.text,
    }),
    li: css({
      margin: "0.25em 0",
      "line-height": rhythm.lineHeight,
      "letter-spacing": rhythm.letterSpacing,
      color: palette.text,
    }),
    a: css({
      color: palette.link,
      "text-decoration": "underline",
    }),
    strong: css({
      "font-weight": "700",
      color: chrome.strongAccent ? palette.accent : palette.textStrong,
    }),
    em: css({
      "font-style": "italic",
      color: palette.textMuted,
    }),
    del: css({
      "text-decoration": "line-through",
      color: palette.textMuted,
    }),
    code: css({
      padding: "0.15em 0.35em",
      "border-radius": "3px",
      background: palette.codeBg,
      color: palette.codeText,
      "font-family": "Menlo, Consolas, monospace",
      "font-size": "0.9em",
    }),
    pre: css({
      margin: "1em 0",
      padding: "12px 14px",
      overflow: "hidden",
      "border-radius": "6px",
      background: palette.codeBg,
      color: palette.text,
      "line-height": "1.6",
      "text-align": "left",
      border: `1px solid ${palette.accentBorder}`,
    }),
    hr: css({
      margin: "28px auto",
      border: "0",
      "border-top": `1px solid ${palette.divider}`,
      width: layout === "letter" ? "42%" : "100%",
    }),
    table: css({
      width: "100%",
      margin: "1em 0",
      "border-collapse": "collapse",
      "font-size": "14px",
      "line-height": "1.6",
    }),
    th: css({
      padding: "8px",
      border: `1px solid ${palette.accentBorder}`,
      background: palette.accentSoft,
      "font-weight": "700",
      "text-align": "left",
      color: palette.textStrong,
    }),
    td: css({
      padding: "8px",
      border: `1px solid ${palette.divider}`,
      "text-align": "left",
      color: palette.text,
    }),
    img: css({
      display: "block",
      "max-width": "100%",
      height: "auto",
      margin: "1em auto",
    }),
  };
};

const THEME_BLOCK_LABELS: Record<string, string> = {
  intro: "引言",
  "key-point": "重点观点",
  callout: "提示",
  chapter: "章节",
};

const themeBlockStyles = (
  kind: string,
  palette: PublishPalette,
  layout: PublishLayoutId,
  surface: PublishSurface = "desktop",
) => {
  const phone = surface === "phone";
  const label = phone
    ? `padding: 8px 12px 0; color: ${palette.accent}; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin: 0;`
    : `padding: 10px 14px 0; color: ${palette.accent}; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin: 0;`;
  if (kind === "chapter") {
    return {
      block: `margin: 28px 0 16px; padding: 0 0 4px; border-top: 3px solid ${palette.accent}; color: ${palette.textStrong};`,
      label: `padding: 10px 0 0; color: ${palette.accent}; font-size: 12px; font-weight: 700; letter-spacing: 2px; margin: 0;`,
    };
  }
  if (layout === "letter" || kind === "key-point") {
    return {
      block: phone
        ? `margin: 12px 0; padding: 0 0 2px; border: 1px solid ${palette.accentBorder}; border-radius: 8px; background: ${palette.surface}; color: ${palette.text};`
        : `margin: 20px 0; padding: 0 0 4px; border: 1px solid ${palette.accentBorder}; border-radius: 12px; background: ${palette.surface}; color: ${palette.text};`,
      label,
    };
  }
  if (kind === "callout") {
    return {
      block: `margin: 20px 0; padding: 0 0 4px; border: 1px dashed ${palette.accentBorder}; background: ${palette.accentSoft}; color: ${palette.text};`,
      label,
    };
  }
  return {
    block: phone
      ? `margin: 12px 0; padding: 0 0 2px; border-left: 3px solid ${palette.accent}; background: ${palette.accentSoft}; color: ${palette.text};`
      : `margin: 20px 0; padding: 0 0 4px; border-left: 5px solid ${palette.accent}; background: ${palette.accentSoft}; color: ${palette.text};`,
    label,
  };
};

const isChromeElement = (element: HTMLElement) => element.getAttribute("data-ee-publish-chrome") === "true";

const SERIF_STACK = "Georgia, 'Times New Roman', serif";

const chromeNode = (doc: Document, tag: string, text: string, style: string) => {
  const node = doc.createElement(tag);
  node.setAttribute("data-ee-publish-chrome", "true");
  node.textContent = text;
  node.style.cssText = style;
  return node;
};

const chromeOrnament = (doc: Document, id: PublishOrnamentId, color: string, style: string) => {
  const image = doc.createElement("img");
  image.setAttribute("data-ee-publish-chrome", "true");
  image.setAttribute("data-ee-publish-ornament", id);
  image.alt = "";
  image.src = publishOrnamentDataUri(id, color);
  image.style.cssText = style;
  return image;
};

const wrapBlock = (element: HTMLElement, attr: string, value: string) => {
  if (element.parentElement?.getAttribute(attr) === value) return element.parentElement;
  const wrapper = element.ownerDocument.createElement("section");
  wrapper.setAttribute(attr, value);
  element.parentNode?.insertBefore(wrapper, element);
  wrapper.appendChild(element);
  return wrapper;
};

const wrapHeading = (heading: HTMLElement) => wrapBlock(heading, "data-ee-publish-heading", heading.tagName.toLowerCase());

const appendTitleRule = (
  wrapper: HTMLElement,
  palette: PublishPalette,
  phone: boolean,
  kind: PublishTitleRule,
  align: "left" | "center",
  ornament?: PublishOrnamentId,
) => {
  if (kind === "none") return;
  if (ornament) {
    wrapper.appendChild(
      chromeOrnament(
        wrapper.ownerDocument,
        ornament,
        palette.accent,
        css({
          display: "block",
          width: phone ? "112px" : "148px",
          height: "auto",
          margin: align === "center" ? "8px auto 0" : "8px 0 0",
          padding: "0",
          border: "0",
        }),
      ),
    );
    return;
  }
  const bar = chromeNode(
    wrapper.ownerDocument,
    "p",
    "",
    css({
      width: kind === "brush" ? (align === "center" ? "42%" : "72px") : "42px",
      height: "3px",
      margin: align === "center" ? "8px auto 0" : "8px 0 0",
      padding: "0",
      border: "0",
      background: palette.accent,
      "font-size": "0",
      "line-height": "0",
    }),
  );
  wrapper.appendChild(bar);
  if (phone) bar.style.marginTop = "6px";
};

const decorateTitle = (
  heading: HTMLElement,
  chrome: PublishLayoutChrome,
  palette: PublishPalette,
  phone: boolean,
  layout: PublishLayoutId,
) => {
  const ornaments = PUBLISH_LAYOUT_ORNAMENTS[layout];
  const wrapper = wrapHeading(heading);
  wrapper.style.cssText = css({
    margin: phone ? "0 0 16px" : "0 0 24px",
    padding: "0",
  });
  heading.style.margin = "0";
  if (chrome.kicker) {
    wrapper.insertBefore(
      chromeNode(
        heading.ownerDocument,
        "p",
        chrome.kicker,
        css({
          margin: "0 0 8px",
          padding: "0",
          color: palette.accent,
          "font-size": "11px",
          "font-weight": "600",
          "letter-spacing": "0.16em",
          "line-height": "1.4",
        }),
      ),
      heading,
    );
  }
  if (ornaments?.titleEnd) {
    const table = heading.ownerDocument.createElement("table");
    table.style.cssText = css({
      width: "auto",
      "max-width": "100%",
      "border-collapse": "collapse",
      margin: chrome.h1Align === "center" ? "0 auto" : "0",
      padding: "0",
      border: "0",
    });
    const row = heading.ownerDocument.createElement("tr");
    const titleCell = heading.ownerDocument.createElement("td");
    titleCell.style.cssText = "padding:0;border:0;vertical-align:middle;";
    titleCell.appendChild(heading);
    const markCell = heading.ownerDocument.createElement("td");
    markCell.setAttribute("data-ee-publish-chrome", "true");
    markCell.style.cssText = "padding:0 0 0 8px;border:0;vertical-align:middle;width:1%;";
    markCell.appendChild(
      chromeOrnament(
        heading.ownerDocument,
        ornaments.titleEnd,
        palette.accent,
        css({
          display: "block",
          width: phone ? "22px" : "28px",
          height: "auto",
          margin: "0",
          padding: "0",
          border: "0",
        }),
      ),
    );
    row.appendChild(titleCell);
    row.appendChild(markCell);
    table.appendChild(row);
    wrapper.appendChild(table);
  }
  appendTitleRule(wrapper, palette, phone, chrome.h1Rule, chrome.h1Align, ornaments?.titleRule);
  if (chrome.h1Vol) {
    wrapper.appendChild(
      chromeNode(
        heading.ownerDocument,
        "p",
        "VOL. 01",
        css({
          margin: "6px 0 0",
          padding: "0",
          color: palette.textMuted,
          "font-size": "11px",
          "font-weight": "600",
          "letter-spacing": "0.14em",
        }),
      ),
    );
  }
};

const asideNumberTable = (
  heading: HTMLElement,
  number: string,
  palette: PublishPalette,
  phone: boolean,
  options: {
    serif?: boolean;
    part?: boolean;
    badge?: boolean;
    mark?: PublishOrnamentId;
    end?: PublishOrnamentId;
  },
) => {
  const wrapper = wrapHeading(heading);
  wrapper.style.cssText = css({
    margin: phone ? "18px 0 12px" : "28px 0 16px",
    padding: "0",
  });
  const doc = heading.ownerDocument;
  const table = doc.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;margin:0;padding:0;border:0;";
  const row = doc.createElement("tr");
  const numberCell = doc.createElement("td");
  numberCell.setAttribute("data-ee-publish-chrome", "true");
  numberCell.style.cssText = css({
    width: options.badge ? "1%" : "1%",
    padding: options.badge ? "0 10px 0 0" : "0 12px 0 0",
    "vertical-align": "middle",
    "white-space": "nowrap",
    border: "0",
  });
  const numberLabel = chromeNode(
    doc,
    "p",
    number,
    options.badge
      ? css({
          margin: "0",
          padding: phone ? "5px 8px" : "6px 8px",
          color: "#ffffff",
          background: palette.accent,
          "border-radius": "6px",
          "font-size": phone ? "13px" : "14px",
          "font-weight": "700",
          "line-height": "1",
          "text-align": "center",
          "white-space": "nowrap",
        })
      : css({
          margin: "0",
          padding: "0",
          color: palette.accent,
          "font-family": options.serif ? SERIF_STACK : "inherit",
          "font-size": phone ? "28px" : options.serif ? "42px" : "34px",
          "font-style": options.serif ? "italic" : "normal",
          "font-weight": "700",
          "line-height": "1",
          "white-space": "nowrap",
        }),
  );
  numberCell.appendChild(numberLabel);
  if (options.part) {
    numberCell.appendChild(
      chromeNode(
        doc,
        "p",
        "PART",
        css({
          margin: "4px 0 0",
          padding: "0",
          color: palette.accent,
          "font-size": "10px",
          "font-weight": "700",
          "letter-spacing": "0.16em",
          "line-height": "1",
        }),
      ),
    );
  }
  const titleCell = doc.createElement("td");
  titleCell.style.cssText = "vertical-align:middle;padding:0;border:0;";
  heading.style.margin = "0";
  heading.style.padding = "0";
  titleCell.appendChild(heading);
  row.appendChild(numberCell);
  if (options.mark) {
    const markCell = doc.createElement("td");
    markCell.setAttribute("data-ee-publish-chrome", "true");
    markCell.style.cssText = "vertical-align:middle;padding:0 8px 0 0;border:0;width:1%;";
    markCell.appendChild(
      chromeOrnament(
        doc,
        options.mark,
        palette.accent,
        css({
          display: "block",
          width: phone ? "18px" : "22px",
          height: "auto",
          margin: "0",
          padding: "0",
          border: "0",
        }),
      ),
    );
    row.appendChild(markCell);
  }
  row.appendChild(titleCell);
  if (options.end) {
    const endCell = doc.createElement("td");
    endCell.setAttribute("data-ee-publish-chrome", "true");
    endCell.style.cssText = "vertical-align:middle;padding:0 0 0 8px;border:0;width:1%;";
    endCell.appendChild(
      chromeOrnament(
        doc,
        options.end,
        palette.accent,
        css({
          display: "block",
          width: phone ? "22px" : "26px",
          height: "auto",
          margin: "0",
          padding: "0",
          border: "0",
        }),
      ),
    );
    row.appendChild(endCell);
  }
  table.appendChild(row);
  wrapper.appendChild(table);
  return wrapper;
};

const decorateChapter = (
  heading: HTMLElement,
  chapterLabel: string,
  chrome: PublishLayoutChrome,
  palette: PublishPalette,
  phone: boolean,
  layout: PublishLayoutId,
) => {
  const stacked = (lines: Array<{ text: string; style: string }>) => {
    const wrapper = wrapHeading(heading);
    wrapper.style.cssText = css({
      margin: phone ? "18px 0 12px" : "28px 0 16px",
      padding: "0",
    });
    for (const line of lines) {
      wrapper.insertBefore(chromeNode(heading.ownerDocument, "p", line.text, line.style), heading);
    }
    heading.style.margin = "6px 0 0";
    return wrapper;
  };

  const ornaments = PUBLISH_LAYOUT_ORNAMENTS[layout];
  switch (chrome.chapter) {
    case "aside-serif":
      return asideNumberTable(heading, chapterLabel, palette, phone, {
        serif: true,
        mark: ornaments?.chapterMark,
        end: ornaments?.chapterEnd,
      });
    case "aside-part":
      return asideNumberTable(heading, chapterLabel, palette, phone, { serif: true, part: true });
    case "badge":
      return asideNumberTable(heading, chapterLabel, palette, phone, { badge: true });
    case "badge-section": {
      const wrapper = asideNumberTable(heading, chapterLabel, palette, phone, { badge: true });
      const titleCell = wrapper.querySelector("td:last-child");
      if (titleCell && heading.parentElement === titleCell) {
        titleCell.insertBefore(
          chromeNode(
            heading.ownerDocument,
            "p",
            `SECTION ${chapterLabel}`,
            css({
              margin: "0 0 4px",
              padding: "0",
              color: palette.accent,
              "font-size": "11px",
              "font-weight": "700",
              "letter-spacing": "0.14em",
            }),
          ),
          heading,
        );
      }
      return wrapper;
    }
    case "stacked-section":
      return stacked([
        {
          text: chapterLabel,
          style: css({
            margin: "0",
            padding: "0",
            color: palette.accent,
            "font-family": SERIF_STACK,
            "font-size": phone ? "36px" : "52px",
            "font-style": "italic",
            "font-weight": "700",
            "line-height": "0.9",
            "white-space": "nowrap",
          }),
        },
        {
          text: `SECTION ${chapterLabel}`,
          style: css({
            margin: "6px 0 0",
            padding: "0",
            color: palette.textMuted,
            "font-size": "11px",
            "font-weight": "700",
            "letter-spacing": "0.16em",
          }),
        },
      ]);
    case "kicker":
      return stacked([
        {
          text: `${chapterLabel} · CHAPTER ONE`,
          style: css({
            margin: "0",
            padding: "0",
            color: palette.textMuted,
            "font-size": "11px",
            "font-weight": "600",
            "letter-spacing": "0.16em",
          }),
        },
      ]);
    case "issue":
      return stacked([
        {
          text: `NO. ${chapterLabel}`,
          style: css({
            margin: "0",
            padding: "0",
            color: palette.textMuted,
            "font-size": "11px",
            "font-weight": "600",
            "letter-spacing": "0.16em",
          }),
        },
      ]);
    default:
      return wrapHeading(heading);
  }
};

const decorateSmallHeading = (
  heading: HTMLElement,
  chrome: PublishLayoutChrome,
  palette: PublishPalette,
  phone: boolean,
) => {
  const wrapper = wrapHeading(heading);
  wrapper.style.cssText = css({
    margin: phone ? "14px 0 8px" : "24px 0 12px",
    padding: "0",
  });
  heading.style.margin = "0";
  if (chrome.small === "bookmark") {
    heading.style.textAlign = "center";
    const rule = heading.ownerDocument.createElement("table");
    rule.setAttribute("data-ee-publish-chrome", "true");
    rule.style.cssText = "width:160px;margin:10px auto 0;border-collapse:collapse;border:0;";
    const row = heading.ownerDocument.createElement("tr");
    const accent = heading.ownerDocument.createElement("td");
    accent.setAttribute("data-ee-publish-chrome", "true");
    accent.style.cssText = `width:28px;height:0;padding:0;border-top:3px solid ${palette.accent};`;
    const rest = heading.ownerDocument.createElement("td");
    rest.setAttribute("data-ee-publish-chrome", "true");
    rest.style.cssText = `height:0;padding:0;border-top:1px solid ${palette.accentBorder};`;
    row.appendChild(accent);
    row.appendChild(rest);
    rule.appendChild(row);
    wrapper.appendChild(rule);
  }
  if (chrome.small === "slash") {
    wrapper.style.textAlign = "center";
    heading.style.textAlign = "center";
    heading.style.color = palette.accent;
    wrapper.insertBefore(
      chromeNode(
        heading.ownerDocument,
        "p",
        `//`,
        css({
          display: "inline-block",
          margin: "0 8px 0 0",
          padding: "0",
          color: palette.accent,
          "font-weight": "800",
        }),
      ),
      heading,
    );
    wrapper.appendChild(
      chromeNode(
        heading.ownerDocument,
        "p",
        `//`,
        css({
          display: "inline-block",
          margin: "0 0 0 8px",
          padding: "0",
          color: palette.accent,
          "font-weight": "800",
        }),
      ),
    );
    heading.style.display = "inline";
  }
  if (chrome.small === "dash") {
    wrapper.insertBefore(
      chromeNode(
        heading.ownerDocument,
        "span",
        "—  ",
        css({
          color: palette.textMuted,
          "font-weight": "600",
        }),
      ),
      heading,
    );
    heading.style.display = "inline";
  }
};

const decorateHeadings = (
  root: HTMLElement,
  layout: PublishLayoutId,
  palette: PublishPalette,
  surface: PublishSurface = "desktop",
) => {
  const chrome = PUBLISH_LAYOUT_CHROME[layout];
  const phone = surface === "phone";
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3")).filter((heading) => {
    if (heading.closest("table, pre, [data-edgeever-theme-block]")) return false;
    if (heading.closest("[data-ee-publish-heading]")) return false;
    return true;
  });

  let chapterIndex = 0;
  for (const heading of headings) {
    const tag = heading.tagName.toLowerCase();
    const plan = planHeadingDecoration(tag, layout, chapterIndex);
    if (plan.kind === "chapter") chapterIndex += 1;
    if (plan.kind === "title") {
      decorateTitle(heading, chrome, palette, phone, layout);
      continue;
    }
    if (plan.kind === "chapter" && plan.chapterLabel) {
      decorateChapter(heading, plan.chapterLabel, chrome, palette, phone, layout);
      continue;
    }
    if (plan.kind === "small") {
      decorateSmallHeading(heading, chrome, palette, phone);
    }
    const headingRule = PUBLISH_LAYOUT_ORNAMENTS[layout]?.headingRule;
    if (tag === "h2" && headingRule) {
      const wrapper = wrapHeading(heading);
      wrapper.appendChild(
        chromeOrnament(
          heading.ownerDocument,
          headingRule,
          palette.accent,
          css({
            display: "block",
            width: phone ? "72px" : "96px",
            height: "auto",
            margin: "6px 0 0",
            padding: "0",
            border: "0",
          }),
        ),
      );
    }
  }
};

const decorateQuotes = (
  root: HTMLElement,
  layout: PublishLayoutId,
  palette: PublishPalette,
  surface: PublishSurface = "desktop",
) => {
  const chrome = PUBLISH_LAYOUT_CHROME[layout];
  const phone = surface === "phone";
  root.querySelectorAll<HTMLElement>("blockquote").forEach((quote) => {
    if (quote.closest("[data-ee-publish-quote], table, pre, [data-edgeever-theme-block]")) return;
    const wrapper = wrapBlock(quote, "data-ee-publish-quote", chrome.quote);
    wrapper.style.cssText = css({
      margin: phone ? "0 0 14px" : "0 0 28px",
      padding: "0",
    });
    quote.style.margin = "0";
    const ornaments = PUBLISH_LAYOUT_ORNAMENTS[layout];
    if (ornaments?.quoteTape) {
      const tapeRow = chromeNode(
        quote.ownerDocument,
        "p",
        "",
        css({
          margin: phone ? "0 8px -4px 0" : "0 12px -6px 0",
          padding: "0",
          "text-align": "right",
          "font-size": "0",
          "line-height": "0",
        }),
      );
      tapeRow.appendChild(
        chromeOrnament(
          quote.ownerDocument,
          ornaments.quoteTape,
          palette.accent,
          css({
            display: "inline-block",
            width: phone ? "42px" : "54px",
            height: "auto",
            margin: "0",
            padding: "0",
            border: "0",
            transform: "rotate(12deg)",
          }),
        ),
      );
      wrapper.insertBefore(tapeRow, quote);
    }
    if (chrome.quote === "banner" && chrome.quoteBanner) {
      wrapper.style.overflow = "hidden";
      wrapper.style.borderRadius = "8px";
      wrapper.insertBefore(
        chromeNode(
          quote.ownerDocument,
          "p",
          chrome.quoteBanner,
          css({
            margin: "0",
            padding: phone ? "8px 12px" : "9px 16px",
            color: "#ffffff",
            background: palette.accent,
            "font-size": "11px",
            "font-weight": "700",
            "letter-spacing": "0.16em",
          }),
        ),
        quote,
      );
    }
    if (chrome.quote === "labeled" && chrome.quoteBanner) {
      wrapper.insertBefore(
        chromeNode(
          quote.ownerDocument,
          "p",
          chrome.quoteBanner,
          css({
            margin: "0 0 10px",
            padding: "0",
            color: palette.textMuted,
            "font-size": "11px",
            "font-weight": "700",
            "letter-spacing": "0.18em",
            "text-align": "center",
          }),
        ),
        quote,
      );
    }
    if (ornaments?.quoteMark) {
      wrapper.insertBefore(
        chromeOrnament(
          quote.ownerDocument,
          ornaments.quoteMark,
          palette.accent,
          css({
            display: "block",
            width: phone ? "22px" : "28px",
            height: "auto",
            margin: phone ? "0 0 2px 12px" : "0 0 4px 16px",
            padding: "0",
            border: "0",
          }),
        ),
        quote,
      );
    } else if (chrome.quote === "marks" || chrome.quote === "grid-card") {
      wrapper.insertBefore(
        chromeNode(
          quote.ownerDocument,
          "p",
          "“",
          css({
            margin: "0 0 4px",
            padding: "0",
            color: palette.accent,
            "font-family": SERIF_STACK,
            "font-size": phone ? "28px" : "34px",
            "font-weight": "700",
            "line-height": "1",
          }),
        ),
        quote,
      );
    }
    if (chrome.quote === "italic-center") {
      wrapper.appendChild(
        chromeNode(
          quote.ownerDocument,
          "p",
          "—",
          css({
            margin: "8px 0 0",
            padding: "0",
            color: palette.accent,
            "text-align": "center",
            "letter-spacing": "0.2em",
          }),
        ),
      );
    }
  });
};

const applyThemeBlocks = (
  root: HTMLElement,
  layout: PublishLayoutId,
  palette: PublishPalette,
  surface: PublishSurface = "desktop",
) => {
  root.querySelectorAll<HTMLElement>("[data-edgeever-theme-block]").forEach((block) => {
    const kind = block.getAttribute("data-theme-block-kind") || "intro";
    const styles = themeBlockStyles(kind, palette, layout, surface);
    block.style.cssText = `${styles.block}${block.style.cssText}`;
    const label = root.ownerDocument.createElement("p");
    label.setAttribute("data-ee-publish-chrome", "true");
    label.textContent = THEME_BLOCK_LABELS[kind] || "主题组件";
    label.style.cssText = styles.label;
    block.insertBefore(label, block.firstChild);
  });
};

export const collectPublishStyleText = (styles: PublishTagStyles) => Object.values(styles).join(" ");

export const assertWeChatSafeCss = (source: string) => {
  const forbidden = [
    /var\s*\(/i,
    /\bdisplay\s*:\s*flex\b/i,
    /\bdisplay\s*:\s*grid\b/i,
    /\bposition\s*:\s*(absolute|fixed|sticky)\b/i,
    /::?(?:before|after)\b/i,
    /url\s*\(/i,
  ];
  return forbidden.every((pattern) => !pattern.test(source));
};

export const applyPublishLayout = (
  root: HTMLElement,
  layout: PublishLayoutId = readPublishLayoutPreference(),
  paletteId: PublishPaletteId = readPublishPalettePreference(),
  surface: PublishSurface = "desktop",
) => {
  const palette = PUBLISH_PALETTES[paletteId] ?? PUBLISH_PALETTES[DEFAULT_PUBLISH_PALETTE];
  const styles = buildPublishStyles(layout, palette, surface);
  root.style.cssText = `${styles.root}; ${css(publishColorCssVars(palette, "article"))}`;

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (isChromeElement(element)) return;
    if (element.closest("pre") && element.tagName.toLowerCase() !== "pre") return;
    const tagName = element.tagName.toLowerCase();
    const style = styles[tagName];
    if (style) element.style.cssText = `${style}${element.style.cssText}`;
  });

  root.querySelectorAll<HTMLElement>("pre code").forEach((element) => {
    element.style.cssText =
      "padding: 0; background: transparent; color: inherit; font-family: Menlo, Consolas, monospace; font-size: 13px; white-space: pre-wrap;";
  });

  root.querySelectorAll<HTMLElement>("hr[data-edgeever-merge-divider], hr.edgeever-merge-divider").forEach((divider) => {
    divider.style.cssText = css({
      margin: "1.75em 0",
      border: "0",
      "border-top": `2px solid ${palette.accent}`,
    });
  });

  decorateHeadings(root, layout, palette, surface);
  decorateQuotes(root, layout, palette, surface);
  applyThemeBlocks(root, layout, palette, surface);
};

