import { buildDiagramPalette, DIAGRAM_SELECTABLE_THEMES, resolveDiagramTheme, type DiagramTheme } from "@edgeever/shared";

export type DiagramAppearance = "light" | "dark";

export type DiagramPalette = {
  topicFill: string;
  topicText: string;
  nodeFill: string;
  nodeText: string;
  nodeStroke: string;
  topicStroke: string;
  mindMapEdge: string;
  flowEdge: string;
  canvas: string;
  grid: string;
  gridStrong: string;
};

const withGrid = (
  palette: ReturnType<typeof buildDiagramPalette>,
  appearance: DiagramAppearance,
  theme: DiagramTheme,
): DiagramPalette => {
  const plain = resolveDiagramTheme(theme) === "plain";
  return {
    ...palette,
    grid: plain
      ? (appearance === "dark" ? "#242424" : "#E6E6E6")
      : (appearance === "dark" ? "#1D2722" : "#E6EEE9"),
    gridStrong: plain
      ? (appearance === "dark" ? "#333333" : "#D4D4D4")
      : (appearance === "dark" ? "#2B3A33" : "#CFDDD5"),
  };
};

export const DIAGRAM_THEME_PALETTES = Object.fromEntries(
  DIAGRAM_SELECTABLE_THEMES.map((theme) => [theme, {
    light: withGrid(buildDiagramPalette(theme, "light"), "light", theme),
    dark: withGrid(buildDiagramPalette(theme, "dark"), "dark", theme),
  }]),
) as Record<typeof DIAGRAM_SELECTABLE_THEMES[number], Record<DiagramAppearance, DiagramPalette>>;

export const resolveDiagramPalette = (theme: DiagramTheme, appearance: DiagramAppearance) =>
  withGrid(buildDiagramPalette(resolveDiagramTheme(theme), appearance), appearance, theme);
