import type { PosterDocument, PosterText } from "@edgeever/shared";
import { AppError } from "./app-error";

export type PosterSection = { heading: string; body: string };
export type PosterContentPlan = {
  heading: string;
  subtitle: string;
  badge: string;
  footer: string;
  layout: "auto" | "grid" | "list";
  sections: PosterSection[];
};

// Compile semantic content into ordinary v1 elements: every block remains editable
// and works with the existing editor, resource renderer and Markdown fallback.
export function layoutPosterContent(document: PosterDocument, plan: PosterContentPlan) {
  const { width: w, height: h } = document;
  const unit = Math.min(w, h);
  const margin = unit * 0.065;
  const gap = unit * 0.025;
  const inner = w - margin * 2;
  const ink = "#07130b";
  const dark = document.background === ink;
  const accent = dark ? "#baf264" : "#16a06e";
  document.elements = [];
  const rect = (id: string, x: number, y: number, width: number, height: number, fill: string, groupId?: string) => {
    document.elements.push({ id, name: id, type: "rect", role: "decor", x, y, width, height, fill, rotation: 0, opacity: 1, ...(groupId ? { groupId } : {}) });
  };
  const text = (id: string, content: string, x: number, y: number, width: number, height: number, size: number, fill: string, bold = false, role: PosterText["role"] = "decor", groupId?: string) => {
    if (!content) return;
    const lines = (fontSize: number) => content.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length * fontSize / width)), 0);
    let fontSize = Math.max(14, Math.floor(size));
    while (fontSize > 14 && lines(fontSize) * fontSize * 1.3 > height) fontSize--;
    if (lines(fontSize) * fontSize * 1.3 > height) {
      throw new AppError("invalid_params", "Poster content does not fit. Shorten section copy or use fewer sections/a taller format.", 400);
    }
    document.elements.push({ id, name: id, type: "text", role, text: content, sourceText: content, x, y, width, height, fontSize, fill, fontFamily: "sans-serif", fontWeight: bold ? "bold" : "normal", textAlign: "left", lineHeight: 1.3, rotation: 0, opacity: 1, ...(groupId ? { groupId } : {}) });
  };
  const headerEnd = h * 0.32;
  rect("content-header", 0, 0, w, headerEnd, ink);
  rect("accent", margin, h * 0.045, unit * 0.09, unit * 0.008, accent);
  text("badge", plan.badge, margin + unit * 0.12, h * 0.032, inner - unit * 0.12, h * 0.04, unit * 0.022, accent, true, "badge");
  text("heading", plan.heading, margin, h * 0.09, inner, h * 0.13, Math.min(w * 0.075, h * 0.065), "#ffffff", true, "title");
  text("subtitle", plan.subtitle, margin, h * 0.24, inner, h * 0.065, unit * 0.026, "#ffffff", false, "subtitle");

  // Wide canvases need columns; portrait step-by-step copy benefits from rows.
  const useGrid = plan.layout === "grid" || (plan.layout === "auto" && w / h >= 0.7);
  const columns = useGrid ? Math.min(plan.sections.length, w / h >= 1.5 ? 3 : 2) : 1;
  const rows = Math.ceil(plan.sections.length / columns);
  const top = headerEnd + gap;
  const bottom = plan.footer ? h * 0.88 : h - margin;
  const cellHeight = (bottom - top - gap * (rows - 1)) / rows;
  const cellWidth = (inner - gap * (columns - 1)) / columns;
  plan.sections.forEach((section, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const span = index === plan.sections.length - 1 && col < columns - 1;
    const x = margin + col * (cellWidth + gap);
    const y = top + row * (cellHeight + gap);
    const width = span ? inner - col * (cellWidth + gap) : cellWidth;
    const pad = Math.min(unit * 0.027, cellHeight * 0.09);
    const group = `section-${index + 1}`;
    rect(`${group}-card`, x, y, width, cellHeight, dark ? "#14281e" : "#ffffff", group);
    rect(`${group}-accent`, x, y, unit * 0.005, cellHeight, accent, group);
    const labelHeight = Math.max(19, Math.min(unit * 0.024, cellHeight * 0.13));
    const headingHeight = cellHeight * 0.26;
    text(`${group}-number`, String(index + 1).padStart(2, "0"), x + pad, y + pad, width - pad * 2, labelHeight, labelHeight / 1.3, accent, true, "decor", group);
    text(`${group}-heading`, section.heading, x + pad, y + pad + labelHeight + pad / 2, width - pad * 2, headingHeight, Math.min(unit * 0.033, headingHeight / 1.3), dark ? "#ffffff" : ink, true, "decor", group);
    const bodyY = y + pad * 2 + labelHeight + headingHeight;
    text(`${group}-body`, section.body, x + pad, bodyY, width - pad * 2, y + cellHeight - pad - bodyY, unit * 0.024, dark ? "#d5e8dc" : "#35483c", false, "decor", group);
  });
  if (plan.footer) {
    rect("footer-rule", margin, h * 0.915, inner, Math.max(1, unit * 0.0015), accent);
    text("footer", plan.footer, margin, h * 0.935, inner, h * 0.045, unit * 0.02, dark ? "#d5e8dc" : "#35483c");
  }
  document.copy = { title: plan.heading, subtitle: plan.subtitle, badge: plan.badge };
}
