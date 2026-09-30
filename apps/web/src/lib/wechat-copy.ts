import type { Editor } from "@tiptap/react";
import {
  DEFAULT_NOTE_PROSE_FONT_SIZE,
  DEFAULT_NOTE_PROSE_LINE_HEIGHT,
  flattenDetailsForLinearHtml,
  NOTE_PROSE_HEADING_SCALE,
  NOTE_PROSE_PARAGRAPH_SPACING_PX,
  noteProseCodeFontSize,
  parseNoteProseLineHeight,
  type NoteProsePaletteColors,
} from "@edgeever/shared";
import { marked } from "marked";
import { MERMAID_THEME_PALETTES } from "@/components/ThemeProvider";
import { copyHtmlToClipboard } from "@/lib/clipboard";
import { parseCustomCssToStyles } from "@/lib/css-sandbox";

const PARAGRAPH_SPACING = `${NOTE_PROSE_PARAGRAPH_SPACING_PX}px`;

const HEADING_LAYOUT = {
  h1: { margin: "1.2em 0 0.6em", lineHeight: 1.35 },
  h2: { margin: "1.1em 0 0.55em", lineHeight: 1.4 },
  h3: { margin: "1em 0 0.5em", lineHeight: 1.45 },
  h4: { margin: "0.95em 0 0.45em", lineHeight: 1.5 },
  h5: { margin: "0.9em 0 0.4em", lineHeight: 1.5 },
  h6: { margin: "0.85em 0 0.35em", lineHeight: 1.5 },
} as const;

type WeChatMetrics = {
  fontSize: number;
  lineHeight: number;
};

const headingStyle = (tag: keyof typeof HEADING_LAYOUT, metrics: WeChatMetrics, color: string) => {
  const layout = HEADING_LAYOUT[tag];
  const size = Math.round(metrics.fontSize * NOTE_PROSE_HEADING_SCALE[tag]);
  return `margin: ${layout.margin}; font-size: ${size}px; line-height: ${layout.lineHeight}; font-weight: 700; color: ${color};`;
};

const applyLegacyWeChatStyles = (
  root: HTMLElement,
  metrics: WeChatMetrics,
  colors: NoteProsePaletteColors | null,
  accentOnly = false,
) => {
  const fontSize = `${metrics.fontSize}px`;
  const lineHeight = String(metrics.lineHeight);
  const codeSize = `${noteProseCodeFontSize(metrics.fontSize)}px`;
  // Named hues move link, inline-code, and bold ink. The rest stays on the WeChat defaults.
  const painted = accentOnly ? null : colors;
  const text = painted?.text ?? "#333";
  const headingColor = painted?.text ?? "#1f2937";
  const background = painted?.background ?? "#ffffff";
  const accent = colors?.accent ?? "#059669";
  const quoteBorder = painted?.accent ?? "#10b981";
  const quoteBackground = painted?.surface ?? "#f0fdf4";
  const quoteColor = painted?.muted ?? "#4b5563";
  const link = colors?.link ?? "#059669";
  const inlineCodeBackground = painted?.codeBackground ?? "#f3f4f6";
  const inlineCodeColor = (accentOnly ? colors?.codeText : painted?.codeText) ?? "#be123c";
  const preBackground = painted?.codeBackground ?? "#f6f8fa";
  const preColor = painted?.codeText ?? "#24292f";
  const ruleColor = painted?.divider ?? "#e5e7eb";
  const cellBorder = painted?.divider ?? "#d1d5db";
  const headBackground = painted?.surface ?? "#f3f4f6";
  const cellColor = painted ? ` color: ${text};` : "";
  const bold = colors ? `font-weight: 700; color: ${accent};` : "font-weight: 700;";
  const styles: Record<string, string> = {
    p: `margin: 0 0 ${PARAGRAPH_SPACING}; padding: 0; line-height: ${lineHeight}; font-size: ${fontSize}; color: ${text};`,
    h1: headingStyle("h1", metrics, headingColor),
    h2: headingStyle("h2", metrics, headingColor),
    h3: headingStyle("h3", metrics, headingColor),
    h4: headingStyle("h4", metrics, headingColor),
    h5: headingStyle("h5", metrics, headingColor),
    h6: headingStyle("h6", metrics, headingColor),
    blockquote: `margin: 1em 0; padding: 0.6em 1em; border-left: 4px solid ${quoteBorder}; background: ${quoteBackground}; color: ${quoteColor}; line-height: ${lineHeight};`,
    ul: `margin: 0 0 1em; padding-left: 1.6em; line-height: ${lineHeight};`,
    ol: `margin: 0 0 1em; padding-left: 1.6em; line-height: ${lineHeight};`,
    li: `margin: 0.25em 0; line-height: ${lineHeight};`,
    a: `color: ${link}; text-decoration: underline;`,
    strong: bold,
    b: bold,
    em: "font-style: italic;",
    del: "text-decoration: line-through;",
    code: `padding: 0.15em 0.35em; border-radius: 3px; background: ${inlineCodeBackground}; color: ${inlineCodeColor}; font-family: Menlo, Consolas, monospace; font-size: ${codeSize};`,
    pre: `margin: 1em 0; padding: 12px 14px; overflow: hidden; border-radius: 6px; background: ${preBackground}; color: ${preColor}; line-height: 1.6; text-align: left;`,
    hr: `margin: 1.5em 0; border: 0; border-top: 1px solid ${ruleColor};`,
    table: `width: 100%; margin: 1em 0; border-collapse: collapse; font-size: ${fontSize}; line-height: 1.6;`,
    th: `padding: 8px; border: 1px solid ${cellBorder}; background: ${headBackground}; font-weight: 700; text-align: left;${cellColor}`,
    td: `padding: 8px; border: 1px solid ${cellBorder}; text-align: left;${cellColor}`,
    img: "display: block; max-width: 100%; height: auto; margin: 1em auto;",
  };

  root.style.cssText = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: ${fontSize}; line-height: ${lineHeight}; color: ${text}; background-color: ${background}; word-break: break-word;`;

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    const isMergeDivider =
      tagName === "hr" && element.matches("[data-edgeever-merge-divider], .edgeever-merge-divider");
    const style = isMergeDivider
      ? `margin: 1.75em 0; border: 0; border-top: 2px solid ${accent};`
      : styles[tagName] || "";
    if (style) element.style.cssText = `${style}${element.style.cssText}`;
  });

  root.querySelectorAll<HTMLElement>("pre code").forEach((element) => {
    element.style.cssText = `padding: 0; background: transparent; color: inherit; font-family: Menlo, Consolas, monospace; font-size: ${codeSize}; white-space: pre-wrap;`;
  });

  if (colors?.accent) {
    root.querySelectorAll<HTMLElement>('ul[data-type="taskList"] li[data-checked] > label input').forEach((element) => {
      element.style.accentColor = colors.accent;
    });
  }
};

const applyInlineStyles = (
  root: HTMLElement,
  metrics: WeChatMetrics,
  colors: NoteProsePaletteColors | null,
  customCss?: string,
  accentOnly = false,
) => {
  applyLegacyWeChatStyles(root, metrics, colors, accentOnly);

  const customStyles = customCss ? parseCustomCssToStyles(customCss) : null;
  if (!customStyles) return;

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (element.getAttribute("data-ee-publish-chrome") === "true") return;
    const extra = customStyles[element.tagName.toLowerCase()];
    if (extra) element.style.cssText = `${element.style.cssText}; ${extra}`;
  });
};

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      resolve(reader.result);
      return;
    }
    reject(new Error("Could not encode image for clipboard"));
  };
  reader.onerror = () => reject(reader.error ?? new Error("Could not read image for clipboard"));
  reader.readAsDataURL(blob);
});

const WECHAT_IMAGE_MIME_TYPES = new Set([
  "image/bmp",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const canvasToPng = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((png) => {
    if (png) {
      resolve(png);
      return;
    }
    reject(new Error("Could not convert image to PNG"));
  }, "image/png");
});

const rasterizeImageElement = async (image: HTMLImageElement, scale = 1) => {
  if (!image.complete || image.naturalWidth === 0) {
    await image.decode();
  }
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("Could not decode image for clipboard");
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(image.naturalWidth * scale);
  canvas.height = Math.ceil(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create image canvas");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToPng(canvas);
};

const rasterizeBlob = async (blob: Blob) => {
  if (blob.type.toLocaleLowerCase() === "image/svg+xml") {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      return rasterizeImageElement(image);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create image canvas");
    }
    context.drawImage(bitmap, 0, 0);
    return canvasToPng(canvas);
  } finally {
    bitmap.close();
  }
};

const convertImageToPng = async (blob: Blob) => {
  if (WECHAT_IMAGE_MIME_TYPES.has(blob.type.toLocaleLowerCase())) {
    return blob;
  }

  return rasterizeBlob(blob);
};

const getSvgSize = (svg: string) => {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const width = Number.parseFloat(root.getAttribute("width") || "");
  const height = Number.parseFloat(root.getAttribute("height") || "");
  const viewBoxWidth = viewBox && viewBox.length === 4 ? viewBox[2] : Number.NaN;
  const viewBoxHeight = viewBox && viewBox.length === 4 ? viewBox[3] : Number.NaN;
  return {
    width: Number.isFinite(viewBoxWidth) ? viewBoxWidth : Number.isFinite(width) ? width : 800,
    height: Number.isFinite(viewBoxHeight) ? viewBoxHeight : Number.isFinite(height) ? height : 600,
  };
};

const WECHAT_MERMAID_MAX_EDGE = 1280;

const prepareSvgMarkup = (svg: string) => {
  const markup = svg.trim();
  if (/<svg\b[^>]*\sxmlns=/.test(markup)) return markup;
  return markup.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
};

const canvasToJpeg = (canvas: HTMLCanvasElement, quality = 0.86) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (jpeg) => {
        if (jpeg) {
          resolve(jpeg);
          return;
        }
        reject(new Error("Could not convert image to JPEG"));
      },
      "image/jpeg",
      quality,
    );
  });

const svgToTransparentPng = async (svg: string) => {
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, image.naturalWidth);
    canvas.height = Math.max(1, image.naturalHeight);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create ornament canvas");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => {
        if (png) {
          resolve(png);
          return;
        }
        reject(new Error("Could not convert ornament to PNG"));
      }, "image/png");
    });
    return blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const rasterizePublishOrnamentsForWeChat = async (root: HTMLElement) => {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img[data-ee-publish-ornament]"));
  await Promise.all(images.map(async (image) => {
    const source = image.getAttribute("src")?.trim() ?? "";
    if (!source.startsWith("data:image/svg+xml")) return;
    try {
      const encoded = source.replace(/^data:image\/svg\+xml(?:;charset=utf-8)?,/, "");
      const svg = decodeURIComponent(encoded);
      image.setAttribute("src", await svgToTransparentPng(svg));
    } catch {
      // Keep the SVG data URI in the live preview; WeChat copy can drop a broken ornament.
    }
  }));
};

const svgToWeChatImage = async (svg: string) => {
  const markup = prepareSvgMarkup(svg);
  const size = getSvgSize(markup);
  const objectUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const naturalWidth = image.naturalWidth || size.width;
    const naturalHeight = image.naturalHeight || size.height;
    const scale = Math.min(2, WECHAT_MERMAID_MAX_EDGE / Math.max(naturalWidth, naturalHeight, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create image canvas");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const displayWidth = Math.min(size.width || naturalWidth, 677);
    const displayHeight = displayWidth * (naturalHeight / Math.max(naturalWidth, 1));
    return {
      blob: await canvasToJpeg(canvas),
      width: displayWidth,
      height: displayHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const renderMermaidSvg = async (source: string) => {
  const { renderMermaidSVG, THEMES } = await import("beautiful-mermaid");
  return renderMermaidSVG(source, {
    ...THEMES["zinc-light"],
    ...MERMAID_THEME_PALETTES["zinc-light"],
    transparent: true,
    font: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: 24,
  });
};

const embedMermaidForWeChat = async (root: HTMLElement, editor?: Editor) => {
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>("pre > code.language-mermaid"));
  if (codeBlocks.length === 0) {
    return;
  }

  const renderedBlocks = editor
    ? Array.from(editor.view.dom.querySelectorAll<HTMLElement>(".edgeever-mermaid-code-block"))
    : [];
  await Promise.all(codeBlocks.map(async (codeBlock, index) => {
    const source = codeBlock.textContent?.trim();
    const pre = codeBlock.closest("pre");
    if (!source || !pre) {
      return;
    }

    try {
      let svg = "";
      try {
        svg = await renderMermaidSvg(source);
      } catch {
        svg = renderedBlocks[index]?.querySelector("svg")?.outerHTML || "";
      }
      if (!svg) return;

      const { blob, width, height } = await svgToWeChatImage(svg);
      const paragraph = document.createElement("p");
      paragraph.style.cssText = "text-align: center; margin: 1em 0;";
      const image = document.createElement("img");
      image.src = await blobToDataUrl(blob);
      image.width = Math.round(width);
      image.height = Math.round(height);
      image.alt = "Mermaid diagram";
      image.style.cssText = "display: inline-block; max-width: 100%; height: auto;";
      paragraph.appendChild(image);
      pre.replaceWith(paragraph);
    } catch {
      // Preserve the Mermaid source as a readable fallback when rendering fails.
    }
  }));
};

const isSameOrigin = (source: string) => {
  try {
    return new URL(source, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

const isContentImage = (image: HTMLImageElement) =>
  Boolean(image.getAttribute("src")?.trim()) && !image.classList.contains("ProseMirror-separator");

const findOriginalImage = (source: string, originals: HTMLImageElement[]) => {
  const match = originals.find((image) => image.getAttribute("src") === source || image.currentSrc === source);
  if (match) return match;
  try {
    const resolved = new URL(source, window.location.href).href;
    return originals.find((image) => image.src === resolved) ?? null;
  } catch {
    return null;
  }
};

const embedImagesForWeChat = async (root: HTMLElement, originalImages: HTMLImageElement[] = []) => {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img")).filter(isContentImage);
  const originals = originalImages.filter(isContentImage);
  await Promise.all(images.map(async (image) => {
    const source = image.getAttribute("src")?.trim();
    if (!source || source.startsWith("data:")) {
      return;
    }

    try {
      const originalImage = findOriginalImage(source, originals);
      if (originalImage) {
        image.setAttribute("src", await blobToDataUrl(await rasterizeImageElement(originalImage)));
        image.removeAttribute("srcset");
        return;
      }

      const response = await fetch(source, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Could not fetch image (${response.status})`);
      }
      image.setAttribute("src", await blobToDataUrl(await convertImageToPng(await response.blob())));
      image.removeAttribute("srcset");
    } catch {
      // Never put a private same-origin URL into the clipboard: WeChat cannot access it.
      if (isSameOrigin(source)) {
        image.removeAttribute("src");
        image.removeAttribute("srcset");
      }
    }
  }));
};

const convertImageGalleriesForWeChat = (root: HTMLElement) => {
  root.querySelectorAll<HTMLElement>("[data-edgeever-image-gallery]").forEach((gallery) => {
    const images = Array.from(gallery.children).filter(
      (child): child is HTMLImageElement => child.tagName === "IMG",
    );
    if (images.length < 2) return;

    const layout = gallery.getAttribute("data-image-gallery-layout");
    let columns = Math.min(images.length, 3);
    if (layout === "1") {
      columns = 1;
    } else if (layout === "2" || (layout !== "3" && images.length === 4)) {
      columns = 2;
    } else if (layout === "3") {
      columns = 3;
    }
    const table = document.createElement("table");
    table.setAttribute("role", "presentation");
    table.style.cssText = "width: 100%; margin: 1em 0; border: 0; border-collapse: separate; border-spacing: 6px; table-layout: fixed;";
    const body = document.createElement("tbody");

    images.forEach((image, index) => {
      if (index % columns === 0) body.appendChild(document.createElement("tr"));
      const cell = document.createElement("td");
      cell.style.cssText = `width: ${100 / columns}%; border: 0; padding: 0; vertical-align: middle;`;
      image.style.cssText = "display: block; width: 100%; height: auto; max-height: 18em; margin: 0; border-radius: 6px; object-fit: cover;";
      cell.appendChild(image);
      body.lastElementChild?.appendChild(cell);
    });

    table.appendChild(body);
    gallery.replaceWith(table);
  });
};

const readCssNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readPaletteColor = (style: CSSStyleDeclaration, name: string) => style.getPropertyValue(name).trim();

export const readEditorCopyContext = (from?: HTMLElement | null) => {
  const container = from?.closest<HTMLElement>("[data-note-palette]")
    ?? from?.closest<HTMLElement>("[data-editor-theme]")
    ?? document.querySelector<HTMLElement>("[data-note-palette], [data-editor-theme]");
  const style = container ? getComputedStyle(container) : null;
  const fontSize = readCssNumber(style?.getPropertyValue("--editor-body-font-size"), DEFAULT_NOTE_PROSE_FONT_SIZE);
  const lineHeight = parseNoteProseLineHeight(style?.getPropertyValue("--editor-body-line-height").trim())
    ?? DEFAULT_NOTE_PROSE_LINE_HEIGHT;
  const palette = container?.dataset.notePalette;
  let colors: NoteProsePaletteColors | null = null;
  if (style && palette && palette !== "native") {
    const accent = readPaletteColor(style, "--note-palette-accent");
    const text = readPaletteColor(style, "--note-palette-text");
    if (accent && text) {
      colors = {
        accent,
        text,
        muted: readPaletteColor(style, "--note-palette-muted") || text,
        surface: readPaletteColor(style, "--note-palette-surface") || "#f8fafc",
        divider: readPaletteColor(style, "--note-palette-divider") || "#e5e7eb",
        link: readPaletteColor(style, "--note-palette-link") || accent,
        codeBackground: readPaletteColor(style, "--note-palette-code-bg") || "#f6f8fa",
        codeText: readPaletteColor(style, "--note-palette-code-text") || text,
        background: readPaletteColor(style, "--note-palette-bg") || "#ffffff",
      };
    }
  }
  const customStyleTag = container?.querySelector<HTMLStyleElement>("style[data-theme-custom-css]");
  return {
    fontSize,
    lineHeight,
    colors,
    accentOnly: Boolean(palette && palette !== "native"),
    customCss: customStyleTag?.dataset.originalCss || "",
  };
};

export const preparePublishArticle = (
  html: string,
  from?: HTMLElement | null,
) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  const context = readEditorCopyContext(from);
  applyInlineStyles(
    root,
    { fontSize: context.fontSize, lineHeight: context.lineHeight },
    context.colors,
    context.customCss,
    context.accentOnly,
  );
  flattenDetailsForLinearHtml(root);
  convertImageGalleriesForWeChat(root);
  return root;
};

export const buildWeChatClipboardHtml = async (editor: Editor) => {
  const container = preparePublishArticle(editor.getHTML(), editor.view.dom);
  await embedMermaidForWeChat(container, editor);
  const originalImages = Array.from(editor.view.dom.querySelectorAll<HTMLImageElement>("img")).filter(isContentImage);
  await embedImagesForWeChat(container, originalImages);
  await rasterizePublishOrnamentsForWeChat(container);
  return container.outerHTML;
};

export const copyEditorToWeChat = async (editor: Editor) =>
  copyHtmlToClipboard(await buildWeChatClipboardHtml(editor), editor.getText({ blockSeparator: "\n" }));

export const copyMarkdownToWeChat = async (markdown: string) => {
  const container = preparePublishArticle(
    marked.parse(markdown, { async: false, gfm: true, breaks: false }),
  );
  await embedMermaidForWeChat(container);
  await embedImagesForWeChat(container);
  await rasterizePublishOrnamentsForWeChat(container);
  await copyHtmlToClipboard(container.outerHTML, container.textContent ?? "");
};
