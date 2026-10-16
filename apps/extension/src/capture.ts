import { selectionTextMarkdown } from "./selection-clip";
import { articlePlatform, substackPaywall } from "./article-platform";
import { platformHtmlMarkdown, type PublishedTime } from "./platform-clip";
import { Readability } from "@mozilla/readability";
import { createDocument } from "@mixmark-io/domino";
import { mediumContent } from "./medium-content";
import { substackContent } from "./substack-content";

// This file is injected with chrome.scripting.executeScript({ files }). It
// must remain self-contained because injected files are not loaded as ES
// modules and cannot resolve imports from the extension bundle.
const t = (key: string) => chrome.i18n.getMessage(key) || key;

const root = globalThis as typeof globalThis & {
  __edgeeverPageClipPayload?: { mode?: string; requestId?: string; selectionText?: string };
};
const clipPayload = root.__edgeeverPageClipPayload;
delete root.__edgeeverPageClipPayload;
const frozenSelection = clipPayload?.selectionText;
const selectionOnly = clipPayload?.mode === "selection" || !!frozenSelection;

type CapturedPage = {
  title: string;
  url: string;
  markdown: string;
  plainText?: string;
  kind?: "page" | "selection";
  platform?: "medium" | "substack";
  author?: string;
  publishedAt?: PublishedTime;
};

const getSelectionHtml = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.toString().trim()
    || (frozenSelection !== undefined && selection.toString().replace(/\u00a0/g, " ").trim() !== frozenSelection)) {
    return "";
  }

  const container = document.createElement("div");
  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.appendChild(selection.getRangeAt(index).cloneContents());
  }

  return container.innerHTML.trim();
};

const markdownFromHtml = (html: string) => {
  if (!html) return "";
  // Parse in Domino's inert document, sharing article/table conversion without
  // activating page scripts or media through a browser HTML assignment.
  return platformHtmlMarkdown(createDocument(html).body, location.href);
};

const captureSelection = (): CapturedPage => {
  const plain = frozenSelection ?? window.getSelection()?.toString().replace(/\u00a0/g, " ").trim() ?? "";
  const html = getSelectionHtml();
  return {
    title: document.title.trim() || location.hostname,
    url: location.href,
    markdown: markdownFromHtml(html) || selectionTextMarkdown(plain),
    plainText: plain,
    kind: "selection",
  };
};

// Dynamic sites can contain very large inline SVGs, scripts, and embedded
// documents. They are not article content, but cloning and parsing them makes
// Readability disproportionately expensive (知乎 pages are a common example).
const prepareDocumentForExtraction = () => {
  const candidate = document.querySelector("article, main, [role='main']");
  const clone = candidate
    ? document.implementation.createHTMLDocument(document.title)
    : (document.cloneNode(true) as Document);
  if (candidate) {
    clone.body.appendChild(candidate.cloneNode(true));
  }
  clone
    .querySelectorAll("script, style, noscript, template, iframe, object, embed, canvas, svg, video, audio, source, link, meta")
    .forEach((element) => element.remove());
  return clone;
};

const textFallback = () => {
  const text = document.body?.innerText?.replace(/\s+/g, " ").trim() || "";
  return text ? text.replace(/([\\`*_{}[\]()#+.!|])/g, "\\$1") : t("emptyPageContent");
};

let readingAdaptedArticle = false;
type CaptureReply = CapturedPage | { error: "unreadable" | "restricted" };

const capturePage = (): CaptureReply => {
  const selectionHtml = getSelectionHtml();
  const platform = !selectionHtml ? articlePlatform(document,location.href) : null;
  if (platform) {
    readingAdaptedArticle = true;
    if(platform === "Substack" && substackPaywall(document)) return {error:"restricted"};
    const adapted = platform === "Medium" ? mediumContent(document,location.href) : substackContent(document,location.href);
    const markdown = adapted ? platformHtmlMarkdown(adapted.body,location.href) : "";
    if (!adapted || !markdown) return {error:"unreadable"};
    return {title:adapted.title,url:location.href,markdown,kind:"page",platform:platform === "Medium" ? "medium" : "substack",author:adapted.author,publishedAt:adapted.publishedAt};
  }
  let article: ReturnType<Readability["parse"]> = null;
  let sourceHtml = selectionHtml;

  if (!sourceHtml) {
    const documentClone = prepareDocumentForExtraction();
    article = new Readability(documentClone, {
      charThreshold: 80,
      keepClasses: false,
    }).parse();
    sourceHtml = article?.content || document.querySelector("article, main, [role='main']")?.innerHTML || "";
  }

  const title = article?.title?.trim() || document.title.trim() || location.hostname;
  return {
    title,
    url: location.href,
    markdown: markdownFromHtml(sourceHtml) || textFallback(),
    kind: "page",
  };
};

const sendCapturedPage = (page: CaptureReply) => {
  void chrome.runtime.sendMessage({ type: "capturedPage", requestId: clipPayload?.requestId, page });
};

try {
  sendCapturedPage(selectionOnly ? captureSelection() : capturePage());
} catch {
  // Keep the injected script from failing silently if a page exposes an
  // unusual DOM implementation. The background page will show its timeout
  // message, while ordinary pages still use the normal extraction path.
  // A selection save must not fall back to the whole page.
  sendCapturedPage(readingAdaptedArticle ? {error:"unreadable"} : selectionOnly ? {
    title: document.title.trim() || location.hostname,
    url: location.href,
    markdown: "",
    plainText: "",
    kind: "selection",
  } : {
    title: document.title.trim() || location.hostname,
    url: location.href,
    markdown: textFallback(),
    kind: "page",
  });
}
