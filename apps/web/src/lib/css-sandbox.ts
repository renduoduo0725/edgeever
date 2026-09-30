/**
 * 安全的 CSS 过滤器与作用域限制器
 */

import { sanitizeNoteProseDeclarationBlock } from "@edgeever/shared";

const sanitizeRulesBlock = (block: string): string => sanitizeNoteProseDeclarationBlock(block);

const scopeSelector = (selector: string): string => {
  const trimmed = selector.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(".ProseMirror") || trimmed.includes(".edgeever-editor")) return trimmed;
  const dark = trimmed.match(/^(?:html\.dark|:root\.dark)\s+(.+)$/);
  if (dark) return `:root.dark .edgeever-editor .ProseMirror ${dark[1]}`;
  return `.edgeever-editor .ProseMirror ${trimmed}`;
};

/**
 * 对用户的 CSS 进行安全过滤，并将其作用域限定在当前编辑器的 ProseMirror 区域。
 * :root.dark 留在作用域外面，这样深色规则跟着应用主题走。
 */
export const sanitizeAndScopeCss = (css: string): string => {
  if (!css) return "";

  let cleaned = css
    .replace(/@import/gi, "")
    .replace(/@charset/gi, "")
    .replace(/@namespace/gi, "");

  cleaned = cleaned.replace(/([^{]+)({[^}]+})/g, (_, selectors, blockContent) => {
    const rawRules = blockContent.slice(1, -1);
    const safeRules = sanitizeRulesBlock(rawRules);
    if (!safeRules) return "";

    const scopedSelectors = selectors
      .split(",")
      .map((selector: string) => scopeSelector(selector))
      .filter(Boolean)
      .join(", ");

    return scopedSelectors ? `${scopedSelectors} { ${safeRules} }` : "";
  });

  return cleaned;
};

/** Class on the settings sample. Dark rules bind here instead of :root, so the sample does not follow the app theme. */
export const NOTE_PROSE_CSS_PREVIEW_DARK_CLASS = "note-prose-css-preview-dark";

export const previewNoteProseCss = (css: string): string =>
  sanitizeAndScopeCss(css).replaceAll(":root.dark", `.${NOTE_PROSE_CSS_PREVIEW_DARK_CLASS}`);

/**
 * 动态解析用户的自定义 CSS，并提取出能直接应用于微信/富文本一键复制时的标签样式字典
 */
export const parseCustomCssToStyles = (css: string): Record<string, string> => {
  const stylesMap: Record<string, string> = {};
  if (!css) return stylesMap;

  // 使用简单的正则匹配选择器和规则内容
  const regex = /([^{]+){([^}]+)}/g;
  let match;

  while ((match = regex.exec(css)) !== null) {
    const selectors = match[1].split(",");
    const rawRules = match[2];
    const safeRules = sanitizeRulesBlock(rawRules);

    if (!safeRules) continue;

    selectors.forEach((sel) => {
      const key = sel.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim().toLowerCase();
      // 只提取针对纯标签的简单选择器（如 h1, p, blockquote 等），这样便于直接在微信复制里进行标签内联样式动态覆盖
      if (/^[a-z0-9]+$/i.test(key)) {
        if (stylesMap[key]) {
          stylesMap[key] = `${stylesMap[key]} ${safeRules}`;
        } else {
          stylesMap[key] = safeRules;
        }
      }
    });
  }

  return stylesMap;
};
