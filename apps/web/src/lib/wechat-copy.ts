import type { Editor } from "@tiptap/react";
import { MEMO_CONTENT_STYLE } from "@edgeever/shared";
import { marked } from "marked";
import { MERMAID_THEME_PALETTES } from "@/components/ThemeProvider";
import { copyHtmlToClipboard } from "@/lib/clipboard";
import { parseCustomCssToStyles } from "@/lib/css-sandbox";
import { applyPublishLayout, resolvePaperEditorTheme } from "@/lib/publish-layout";

const BODY_LINE_HEIGHT = MEMO_CONTENT_STYLE.body.lineHeight / MEMO_CONTENT_STYLE.body.fontSize;
const BODY_FONT_SIZE = `${MEMO_CONTENT_STYLE.body.fontSize}px`;
const PARAGRAPH_SPACING = `${MEMO_CONTENT_STYLE.body.paragraphSpacing}px`;

const WECHAT_STYLES: Record<string, string> = {
  p: `margin: 0 0 ${PARAGRAPH_SPACING}; padding: 0; line-height: ${BODY_LINE_HEIGHT}; font-size: ${BODY_FONT_SIZE}; color: #333;`,
  h1: "margin: 1.2em 0 0.6em; font-size: 24px; line-height: 1.35; font-weight: 700; color: #1f2937;",
  h2: "margin: 1.1em 0 0.55em; font-size: 21px; line-height: 1.4; font-weight: 700; color: #1f2937;",
  h3: "margin: 1em 0 0.5em; font-size: 18px; line-height: 1.45; font-weight: 700; color: #1f2937;",
  blockquote: `margin: 1em 0; padding: 0.6em 1em; border-left: 4px solid #10b981; background: #f0fdf4; color: #4b5563; line-height: ${BODY_LINE_HEIGHT};`,
  ul: `margin: 0 0 1em; padding-left: 1.6em; line-height: ${BODY_LINE_HEIGHT};`,
  ol: `margin: 0 0 1em; padding-left: 1.6em; line-height: ${BODY_LINE_HEIGHT};`,
  li: `margin: 0.25em 0; line-height: ${BODY_LINE_HEIGHT};`,
  a: "color: #059669; text-decoration: underline;",
  strong: "font-weight: 700;",
  em: "font-style: italic;",
  del: "text-decoration: line-through;",
  code: "padding: 0.15em 0.35em; border-radius: 3px; background: #f3f4f6; color: #be123c; font-family: Menlo, Consolas, monospace; font-size: 0.9em;",
  pre: "margin: 1em 0; padding: 12px 14px; overflow: hidden; border-radius: 6px; background: #f6f8fa; color: #24292f; line-height: 1.6; text-align: left;",
  hr: "margin: 1.5em 0; border: 0; border-top: 1px solid #e5e7eb;",
  table: "width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 14px; line-height: 1.6;",
  th: "padding: 8px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 700; text-align: left;",
  td: "padding: 8px; border: 1px solid #d1d5db; text-align: left;",
  img: "display: block; max-width: 100%; height: auto; margin: 1em auto;",
};

const applyLegacyWeChatStyles = (
  root: HTMLElement,
  customColors?: { bg: string; text: string; accent: string; soft: string; codeBackground: string; border: string } | null,
) => {
  const textColor = customColors ? customColors.text : "#333";
  const bgColors = customColors ? customColors.bg : "#ffffff";
  const accent = customColors ? customColors.accent : "#059669";
  const soft = customColors ? customColors.soft : "#f0fdfa";
  const codeBackground = customColors ? customColors.codeBackground : "#f6f8fa";
  const border = customColors ? customColors.border : "#e5e7eb";

  root.style.cssText = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: ${BODY_FONT_SIZE}; line-height: ${BODY_LINE_HEIGHT}; color: ${textColor}; background-color: ${bgColors}; word-break: break-word;`;

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    let style = WECHAT_STYLES[tagName] || "";
    const isMergeDivider =
      tagName === "hr" && element.matches("[data-edgeever-merge-divider], .edgeever-merge-divider");

    if (isMergeDivider) {
      style = `margin: 1.75em 0; border: 0; border-top: 2px solid ${accent};`;
    } else if (customColors) {
      if (tagName === "p") {
        style = `margin: 0 0 ${PARAGRAPH_SPACING}; padding: 0; line-height: ${BODY_LINE_HEIGHT}; font-size: ${BODY_FONT_SIZE}; color: ${textColor};`;
      } else if (tagName === "h1" || tagName === "h2" || tagName === "h3") {
        style = style.replace("color: #1f2937;", `color: ${textColor};`);
      } else if (tagName === "blockquote") {
        style = `margin: 1em 0; padding: 0.6em 1em; border-left: 4px solid ${accent}; background: ${soft}; color: ${textColor}; line-height: ${BODY_LINE_HEIGHT};`;
      } else if (tagName === "a") {
        style = `color: ${accent}; text-decoration: underline;`;
      } else if (tagName === "code") {
        style = `padding: 0.15em 0.35em; border-radius: 3px; background: ${codeBackground}; color: ${textColor}; font-family: Menlo, Consolas, monospace; font-size: 0.9em;`;
      } else if (tagName === "pre") {
        style = `margin: 1em 0; padding: 12px 14px; overflow: hidden; border-radius: 6px; background: ${codeBackground}; color: ${textColor}; line-height: 1.6; text-align: left;`;
      } else if (tagName === "hr") {
        style = `margin: 1.5em 0; border: 0; border-top: 1px solid ${border};`;
      } else if (tagName === "th") {
        style = `padding: 8px; border: 1px solid ${border}; background: ${soft}; font-weight: 700; text-align: left; color: ${textColor};`;
      } else if (tagName === "td") {
        style = `padding: 8px; border: 1px solid ${border}; text-align: left; color: ${textColor};`;
      }
    }

    if (style) element.style.cssText = `${style}${element.style.cssText}`;
  });

  root.querySelectorAll<HTMLElement>("pre code").forEach((element) => {
    element.style.cssText = "padding: 0; background: transparent; color: inherit; font-family: Menlo, Consolas, monospace; font-size: 13px; white-space: pre-wrap;";
  });
};

const applyInlineStyles = (
  root: HTMLElement,
  editorTheme?: string,
  customColors?: { bg: string; text: string; accent: string; soft: string; codeBackground: string; border: string } | null,
  customCss?: string,
) => {
  const paperTheme = resolvePaperEditorTheme(editorTheme);
  if (paperTheme) {
    applyPublishLayout(root, paperTheme.layout, paperTheme.palette, "phone");
  } else {
    applyLegacyWeChatStyles(root, customColors);
  }

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

export const readEditorCopyContext = (from?: HTMLElement | null) => {
  const closestContainer = from?.closest<HTMLElement>("[data-editor-theme]")
    ?? document.querySelector<HTMLElement>("[data-editor-theme]");
  const editorTheme = closestContainer?.dataset.editorTheme;
  let customColors: { bg: string; text: string; accent: string; soft: string; codeBackground: string; border: string } | null = null;
  if (closestContainer && editorTheme === "custom") {
    const colors = getComputedStyle(closestContainer);
    customColors = {
      bg: colors.getPropertyValue("--editor-theme-bg") || "#ffffff",
      text: colors.getPropertyValue("--editor-theme-text") || "#1f2937",
      accent: colors.getPropertyValue("--editor-theme-accent") || "#059669",
      soft: colors.getPropertyValue("--editor-theme-soft") || "#ecfdf5",
      codeBackground: colors.getPropertyValue("--editor-theme-code-bg") || "#e0ece9",
      border: colors.getPropertyValue("--editor-theme-border") || "#a7f3d0",
    };
  }
  const customStyleTag = closestContainer?.querySelector<HTMLStyleElement>("style[data-theme-custom-css]");
  return {
    editorTheme,
    customColors,
    customCss: customStyleTag?.dataset.originalCss || "",
  };
};

export const preparePublishArticle = (
  html: string,
  from?: HTMLElement | null,
  editorThemeOverride?: string,
) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  const context = readEditorCopyContext(from);
  applyInlineStyles(
    root,
    editorThemeOverride ?? context.editorTheme,
    context.customColors,
    context.customCss,
  );
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
