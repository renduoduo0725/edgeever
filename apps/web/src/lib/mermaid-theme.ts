import type { MermaidThemePalette } from "@/components/ThemeProvider";

export const getOfficialMermaidThemeVariables = (palette: MermaidThemePalette) => {
  const surface = palette.surface ?? palette.bg;
  const accent = palette.accent ?? palette.line ?? palette.fg;
  const line = palette.line ?? palette.muted ?? palette.fg;
  const border = palette.border ?? palette.muted ?? accent;

  return {
    background: palette.bg,
    primaryColor: surface,
    primaryTextColor: palette.fg,
    primaryBorderColor: border,
    secondaryColor: surface,
    secondaryTextColor: palette.fg,
    secondaryBorderColor: border,
    tertiaryColor: surface,
    tertiaryTextColor: palette.fg,
    tertiaryBorderColor: border,
    fontSize: "12px",
    textColor: palette.fg,
    lineColor: line,
    mainBkg: surface,
    nodeBorder: border,
    nodeTextColor: palette.fg,
    edgeLabelBackground: palette.bg,
    clusterBkg: palette.bg,
    clusterBorder: border,
    titleColor: palette.fg,
    actorBkg: surface,
    actorBorder: border,
    actorTextColor: palette.fg,
    actorLineColor: line,
    signalColor: accent,
    signalTextColor: palette.fg,
    labelBoxBkgColor: surface,
    labelBoxBorderColor: border,
    labelTextColor: palette.fg,
    loopTextColor: palette.fg,
    noteBkgColor: surface,
    noteBorderColor: border,
    noteTextColor: palette.fg,
    activationBkgColor: surface,
    activationBorderColor: accent,
    sequenceNumberColor: accent,
    stateBkg: surface,
    stateBorder: border,
    stateLabelColor: palette.fg,
    transitionColor: line,
    labelBackgroundColor: palette.bg,
  };
};
