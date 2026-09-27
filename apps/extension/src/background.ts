import {
  edgeEverFormRequest,
  edgeEverRequest,
  getInstanceOrigin,
  getSettings,
  listNotebooks,
  uploadMemoImage,
  type ExtensionSettings,
} from "./extension";
import {
  filenameForImage,
  imageFromBase64,
  imageFromBytes,
  imageFromDataUrl,
  imageHostName,
  imageOriginPattern,
  isPageImageRead,
  MAX_IMAGE_BYTES,
  noteTitleForImage,
  preferredImageUrls,
  saveCapturedImageNote,
  type ImageNoteClient,
  type PageImageRead,
  type StoredImage,
  type StoredImageFailure,
} from "./image-clip";
import {
  selectionNoteMarkdown,
  selectionNoteTitle,
} from "./selection-clip";
import {
  canonicalStatusUrl,
  isCapturedTweet,
  saveCapturedTweetNote,
  statusIdFromPageUrl,
  tweetNoteTitle,
} from "./tweet-clip";
import { t } from "./i18n";

type CapturedPage = {
  title: string;
  url: string;
  markdown: string;
  plainText?: string;
  kind?: "page" | "selection";
};

type PendingImageSave = {
  urls: string[];
  srcUrl: string;
  pageUrl: string;
  pageTitle: string;
  tabId: number | null;
  frameId: number | null;
  originPattern: string;
  host: string;
};

const IMAGE_MENU_ID = "save-image";
const SELECTION_MENU_ID = "save-selection";
const TWEET_MENU_ID = "save-tweet";
const PENDING_IMAGE_SAVE_KEY = "pendingImageSave";
const IMAGE_SAVE_WINDOW_KEY = "imageSaveWindowId";
const PENDING_TWEET_KEY = "pendingTweetPermission";
const TWEET_WINDOW_KEY = "tweetSaveWindowId";
const TWEET_DOCUMENT_PATTERNS = [
  "https://x.com/*",
  "https://www.x.com/*",
  "https://twitter.com/*",
  "https://www.twitter.com/*",
  "https://mobile.twitter.com/*",
];

const toMarkdown = (page: CapturedPage) => {
  const capturedAt = new Date().toISOString();
  return `# ${page.title.replace(/\n/g, " ")}\n\n${t("sourceLabel")}: [${page.url}](${page.url})\n\n${t("capturedAtLabel")}: ${capturedAt}\n\n---\n\n${page.markdown}`;
};

const compactError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 180);
};

const describeCaptureError = (error: unknown) => {
  const message = compactError(error);
  if (message === t("captureTimeout")) {
    return message;
  }
  if (/cannot access (contents|a page)|missing host permission|extensions gallery|chrome:\/\/|edge:\/\/|about:\/\//i.test(message)) {
    return t("pageAccessDenied");
  }
  return t("captureScriptFailed", message || t("captureUnknownError"));
};

const describeSaveError = (error: unknown) => {
  const message = compactError(error);
  if (/write:resources/i.test(message)) {
    return t("imageResourceScopeRequired");
  }
  if (/failed to fetch|networkerror|load failed|network request/i.test(message)) {
    return t("instanceNetworkFailed");
  }
  return t("saveFailedWithReason", message || t("saveFailed"));
};

const notebookForClip = async (settings: ExtensionSettings) => {
  const notebooks = await listNotebooks(settings);
  const notebookId = settings.notebookId || notebooks.notebooks[0]?.id;
  if (!notebookId) throw new Error(t("noAvailableNotebooks"));
  return notebookId;
};

const createMemo = async (settings: ExtensionSettings, page: CapturedPage) => {
  await edgeEverRequest(settings, "/api/v1/memos", {
    method: "POST",
    body: JSON.stringify({
      notebookId: await notebookForClip(settings),
      title: page.title,
      contentMarkdown: toMarkdown(page),
      tags: ["web-clip"],
    }),
  });
};

const imageNoteClient = (settings: ExtensionSettings): ImageNoteClient => ({
  listNotebooks: () => listNotebooks(settings),
  createMemo: (body) => edgeEverRequest(settings, "/api/v1/memos", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  uploadImage: async (memoId, file) => {
    const uploaded = await uploadMemoImage(settings, memoId, file);
    return uploaded.resource;
  },
  createEditSession: (memoId) => edgeEverRequest(
    settings,
    `/api/v1/memos/${encodeURIComponent(memoId)}/edit-sessions`,
    { method: "POST", body: JSON.stringify({}) },
  ),
  saveMemo: (memoId, body) => edgeEverRequest(
    settings,
    `/api/v1/memos/${encodeURIComponent(memoId)}/save`,
    { method: "POST", body: JSON.stringify(body) },
  ),
  deleteMemo: (memoId) => edgeEverRequest(
    settings,
    `/api/v1/memos/${encodeURIComponent(memoId)}?permanent=1`,
    { method: "DELETE" },
  ),
  createWithImage: async (body) => {
    const buffer = new ArrayBuffer(body.bytes.byteLength);
    new Uint8Array(buffer).set(body.bytes);
    const form = new FormData();
    form.append("notebookId", body.notebookId);
    form.append("title", body.title);
    form.append("contentMarkdown", body.contentMarkdown);
    form.append("tags", JSON.stringify(body.tags));
    form.append("file", new File([buffer], body.filename, { type: body.mimeType }));
    const created = await edgeEverFormRequest<{ memo: { id: string }; resourceId: string }>(
      settings,
      "/api/v1/memos/with-image",
      form,
    );
    if (!created.memo?.id || !created.resourceId) throw new Error("create-missing-id");
    return { memoId: created.memo.id, resourceId: created.resourceId };
  },
});

const scriptTarget = (tabId: number, frameId: number | null) =>
  typeof frameId === "number" ? { tabId, frameIds: [frameId] } : { tabId };

const injectImageHelper = async (tabId: number, frameId: number | null, payload: unknown) => {
  const target = scriptTarget(tabId, frameId);
  await chrome.scripting.executeScript({
    target,
    func: (value: unknown) => {
      (globalThis as { __edgeeverImageClipPayload?: unknown }).__edgeeverImageClipPayload = value;
    },
    args: [payload],
  });
  await chrome.scripting.executeScript({
    target,
    files: ["assets/capture-image.js"],
  });
};

const showFeedback = async (
  tabId: number | null,
  frameId: number | null,
  message: string,
  kind: "success" | "error",
) => {
  if (tabId) {
    try {
      await injectImageHelper(tabId, frameId, { action: "toast", message, kind });
      return;
    } catch {
      // Restricted pages cannot host the toast. The toolbar badge still reports the result.
    }
  }
  await chrome.action.setBadgeBackgroundColor({ color: kind === "error" ? "#b91c1c" : "#0f766e" });
  await chrome.action.setBadgeText({ text: kind === "error" ? "!" : "✓" });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: "" });
  }, 4000);
};

const imageFailureMessage = (reason: StoredImageFailure["error"]) => {
  if (reason === "too-large") return t("imageTooLarge");
  if (reason === "unsupported") return t("imageUnsupportedType");
  return t("imageUnreadable");
};

const describeImageError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (
    message === t("instancePermissionRequired")
    || message === t("completePluginConfiguration")
    || message === t("noAvailableNotebooks")
    || message === t("imageTooLarge")
    || message === t("imageUnsupportedType")
    || message === t("imageUnreadable")
  ) {
    return message;
  }
  return describeSaveError(error);
};

const ensureClipperReady = async () => {
  const settings = await getSettings();
  if (!settings.instanceUrl || !settings.token) {
    throw new Error(t("completePluginConfiguration"));
  }
  const granted = await chrome.permissions.contains({ origins: [`${getInstanceOrigin(settings.instanceUrl)}/*`] });
  if (!granted) throw new Error(t("instancePermissionRequired"));
  return settings;
};

const persistImage = async (
  settings: ExtensionSettings,
  image: StoredImage,
  context: { srcUrl: string; pageUrl: string; pageTitle: string; alt: string },
) => {
  try {
    await saveCapturedImageNote(imageNoteClient(settings), {
      notebookId: settings.notebookId,
      title: noteTitleForImage(context.pageTitle, context.alt, t("imageNoteFallbackTitle")),
      alt: context.alt,
      filename: filenameForImage(context.srcUrl, image.mimeType),
      mimeType: image.mimeType,
      bytes: image.bytes,
      pageUrl: context.pageUrl,
      capturedAt: new Date().toISOString(),
      sourceLabel: t("sourceLabel"),
      capturedAtLabel: t("capturedAtLabel"),
      altFallback: t("imageAltFallback"),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "no-notebook") {
      throw new Error(t("noAvailableNotebooks"));
    }
    throw error;
  }
};

const downloadImage = async (urls: string[]): Promise<StoredImage | StoredImageFailure> => {
  const matchUrl = urls[urls.length - 1] ?? "";
  let matchError: StoredImageFailure["error"] | "" = "";
  for (const url of urls) {
    if (!/^https?:/i.test(url)) continue;
    for (const credentials of ["omit", "include"] as const) {
      try {
        const response = await fetch(url, { credentials });
        if (!response.ok) continue;
        const declared = Number(response.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
          if (url === matchUrl) matchError = "too-large";
          continue;
        }
        const image = imageFromBytes(new Uint8Array(await response.arrayBuffer()), response.headers.get("content-type") ?? "");
        if (!("error" in image)) return image;
        if (url === matchUrl) matchError = image.error;
      } catch {
        if (url === matchUrl) matchError = matchError || "unreadable";
      }
    }
  }
  if (matchError === "too-large" || matchError === "unsupported") return { error: matchError };
  return { error: "unreadable" };
};

const hasImagePermission = async (urls: string[]) => {
  const patterns = [...new Set(urls.map(imageOriginPattern).filter((pattern): pattern is string => Boolean(pattern)))];
  for (const pattern of patterns) {
    if (await chrome.permissions.contains({ origins: [pattern] })) return true;
  }
  return false;
};

const isPendingImageSave = (value: unknown): value is PendingImageSave => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PendingImageSave>;
  return Array.isArray(record.urls)
    && record.urls.every((url) => typeof url === "string")
    && typeof record.srcUrl === "string"
    && typeof record.pageUrl === "string"
    && typeof record.pageTitle === "string"
    && typeof record.originPattern === "string"
    && typeof record.host === "string";
};

const readPendingImageSave = async () => {
  const stored = await chrome.storage.session.get(PENDING_IMAGE_SAVE_KEY);
  return isPendingImageSave(stored[PENDING_IMAGE_SAVE_KEY]) ? stored[PENDING_IMAGE_SAVE_KEY] : null;
};

const focusExtensionWindow = async (path: string, windowKey: string, height: number) => {
  const stored = await chrome.storage.session.get(windowKey);
  const existingId = stored[windowKey];
  const url = chrome.runtime.getURL(path);
  if (typeof existingId === "number") {
    try {
      const existing = await chrome.windows.get(existingId, { populate: true });
      const existingTabId = existing.tabs?.[0]?.id;
      if (existingTabId) {
        await chrome.tabs.update(existingTabId, { url });
        await chrome.windows.update(existingId, { focused: true });
        return;
      }
    } catch {
      // The previous window has already closed.
    }
  }
  const created = await chrome.windows.create({
    url,
    type: "popup",
    width: 440,
    height,
    focused: true,
  });
  if (created.id) await chrome.storage.session.set({ [windowKey]: created.id });
};

const openImagePermissionWindow = async (pending: PendingImageSave) => {
  await chrome.storage.session.set({ [PENDING_IMAGE_SAVE_KEY]: pending });
  await focusExtensionWindow("image-save.html", IMAGE_SAVE_WINDOW_KEY, 640);
};

const openTweetPermissionWindow = async (tabId: number | null) => {
  await chrome.storage.session.set({ [PENDING_TWEET_KEY]: { tabId } });
  await focusExtensionWindow("tweet-save.html", TWEET_WINDOW_KEY, 560);
};

let pendingCapture: ((page: CapturedPage) => void) | null = null;
const pendingImageReads = new Map<string, (result: unknown) => void>();
const pendingTweetReads = new Map<string, (result: unknown) => void>();
let clipQueue = Promise.resolve();
let completingImageSave = false;

const enqueueClip = (job: () => Promise<void>) => {
  const run = clipQueue.then(job, job);
  clipQueue = run.then(() => undefined, () => undefined);
  return run;
};

const readImageFromPage = async (tabId: number, frameId: number | null, urls: string[], matchUrl: string) => {
  const requestId = crypto.randomUUID();
  const result = await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingImageReads.delete(requestId);
      reject(new Error("timeout"));
    }, 20_000);
    pendingImageReads.set(requestId, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
    void injectImageHelper(tabId, frameId, {
      action: "read",
      requestId,
      urls,
      matchUrl,
      maxBytes: MAX_IMAGE_BYTES,
    }).catch((error: unknown) => {
      clearTimeout(timeout);
      pendingImageReads.delete(requestId);
      reject(error);
    });
  });
  return isPageImageRead(result) ? result : { ok: false as const, reason: "unreadable" as const };
};

const reportImageFailure = async (tabId: number | null, frameId: number | null, error: unknown) => {
  const message = describeImageError(error);
  if (message === t("completePluginConfiguration") || message === t("instancePermissionRequired")) {
    await chrome.runtime.openOptionsPage();
  }
  await showFeedback(tabId, frameId, message, "error");
};

const saveDownloadedImage = async (
  pending: Pick<PendingImageSave, "urls" | "srcUrl" | "pageUrl" | "pageTitle" | "tabId" | "frameId">,
  alt: string,
) => {
  const settings = await ensureClipperReady();
  const downloaded = await downloadImage(pending.urls);
  if ("error" in downloaded) throw new Error(imageFailureMessage(downloaded.error));
  await persistImage(settings, downloaded, {
    srcUrl: pending.srcUrl,
    pageUrl: pending.pageUrl,
    pageTitle: pending.pageTitle,
    alt,
  });
  await chrome.storage.session.remove(PENDING_IMAGE_SAVE_KEY);
  await showFeedback(pending.tabId, pending.frameId, t("imageSaved"), "success");
};

const saveImageFromMenu = async (
  info: { srcUrl?: string; pageUrl?: string; frameId?: number },
  tab?: { id?: number; url?: string; title?: string },
) => {
  const tabId = typeof tab?.id === "number" ? tab.id : null;
  const frameId = typeof info.frameId === "number" ? info.frameId : null;
  const srcUrl = info.srcUrl ?? "";
  const pageUrl = tab?.url || info.pageUrl || "";
  const pageTitle = tab?.title || "";
  try {
    await ensureClipperReady();
    if (!srcUrl) throw new Error(t("imageUnreadable"));
    await showFeedback(tabId, frameId, t("savingImage"), "success");
    const inlineImage = imageFromDataUrl(srcUrl);
    if (inlineImage && !("error" in inlineImage)) {
      const settings = await ensureClipperReady();
      await persistImage(settings, inlineImage, { srcUrl, pageUrl, pageTitle, alt: "" });
      await chrome.storage.session.remove(PENDING_IMAGE_SAVE_KEY);
      await showFeedback(tabId, frameId, t("imageSaved"), "success");
      return;
    }
    if (inlineImage && "error" in inlineImage) throw new Error(imageFailureMessage(inlineImage.error));
    const urls = preferredImageUrls(srcUrl);
    let pageRead: PageImageRead | null = null;
    if (tabId) {
      try {
        pageRead = await readImageFromPage(tabId, frameId, urls, srcUrl);
      } catch {
        pageRead = null;
      }
    }
    if (pageRead?.ok) {
      const image = imageFromBase64(pageRead.base64, pageRead.mimeType, pageRead.byteSize);
      if ("error" in image) throw new Error(imageFailureMessage(image.error));
      const settings = await ensureClipperReady();
      await persistImage(settings, image, { srcUrl, pageUrl, pageTitle, alt: pageRead.alt });
      await chrome.storage.session.remove(PENDING_IMAGE_SAVE_KEY);
      await showFeedback(tabId, frameId, t("imageSaved"), "success");
      return;
    }
    if (pageRead && !pageRead.ok && (pageRead.reason === "too-large" || pageRead.reason === "unsupported")) {
      throw new Error(imageFailureMessage(pageRead.reason));
    }
    if (await hasImagePermission(urls)) {
      await saveDownloadedImage({ urls, srcUrl, pageUrl, pageTitle, tabId, frameId }, "");
      return;
    }
    const originPattern = imageOriginPattern(srcUrl);
    const host = imageHostName(srcUrl);
    if (!originPattern || !host) throw new Error(t("imageUnreadable"));
    await openImagePermissionWindow({
      urls,
      srcUrl,
      pageUrl,
      pageTitle,
      tabId,
      frameId,
      originPattern,
      host,
    });
    await showFeedback(tabId, frameId, t("imagePermissionToast"), "success");
  } catch (error) {
    await reportImageFailure(tabId, frameId, error);
  }
};

const injectTweetReader = async (tabId: number, frameId: number | null, payload: unknown) => {
  const target = scriptTarget(tabId, frameId);
  await chrome.scripting.executeScript({
    target,
    func: (value: unknown) => {
      (globalThis as { __edgeeverTweetClipPayload?: unknown }).__edgeeverTweetClipPayload = value;
    },
    args: [payload],
  });
  await chrome.scripting.executeScript({
    target,
    files: ["assets/capture-tweet.js"],
  });
};

const injectTweetTarget = async (tabId: number) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["assets/tweet-target.js"],
  });
};

const readTweetFromPage = async (tabId: number, frameId: number | null, statusId: string) => {
  const requestId = crypto.randomUUID();
  const result = await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingTweetReads.delete(requestId);
      reject(new Error("timeout"));
    }, 10_000);
    pendingTweetReads.set(requestId, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
    void injectTweetReader(tabId, frameId, { requestId, statusId }).catch((error: unknown) => {
      clearTimeout(timeout);
      pendingTweetReads.delete(requestId);
      reject(error);
    });
  });
  return isCapturedTweet(result) ? result : { ok: false as const, reason: "not-found" as const };
};

const hasTweetSitePermission = async (pageUrl: string) => {
  const pattern = imageOriginPattern(pageUrl);
  if (!pattern) return false;
  return chrome.permissions.contains({ origins: [pattern] });
};

const readTweetImage = async (tabId: number, frameId: number | null, url: string, alt: string) => {
  const urls = preferredImageUrls(url);
  try {
    const pageRead = await readImageFromPage(tabId, frameId, urls, url);
    if (pageRead.ok) {
      const image = imageFromBase64(pageRead.base64, pageRead.mimeType, pageRead.byteSize);
      if (!("error" in image)) {
        return { ...image, filename: filenameForImage(url, image.mimeType), alt: alt || pageRead.alt };
      }
    }
  } catch {
    // The page could not hand over this photo. Try a permitted download below.
  }
  if (await hasImagePermission(urls)) {
    const downloaded = await downloadImage(urls);
    if (!("error" in downloaded)) {
      return { ...downloaded, filename: filenameForImage(url, downloaded.mimeType), alt };
    }
  }
  return null;
};

const describeTweetError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (message === t("tweetNotFound")) return message;
  return describeImageError(error);
};

const saveTweetFromMenu = async (
  info: { pageUrl?: string; frameId?: number },
  tab?: { id?: number; url?: string },
) => {
  const tabId = typeof tab?.id === "number" ? tab.id : null;
  const frameId = typeof info.frameId === "number" ? info.frameId : null;
  const pageUrl = tab?.url || info.pageUrl || "";
  try {
    const settings = await ensureClipperReady();
    if (!tabId) throw new Error(t("tweetNotFound"));
    const statusId = statusIdFromPageUrl(pageUrl);
    if (!statusId && !await hasTweetSitePermission(pageUrl)) {
      await openTweetPermissionWindow(tabId);
      await showFeedback(tabId, frameId, t("tweetPermissionToast"), "success");
      return;
    }

    await showFeedback(tabId, frameId, t("savingTweet"), "success");
    const tweet = await readTweetFromPage(tabId, frameId, statusId);
    if (!tweet.ok && tweet.reason === "needs-listener") {
      await injectTweetTarget(tabId);
      await showFeedback(tabId, frameId, t("tweetRightClickAgain"), "success");
      return;
    }
    if (!tweet.ok) throw new Error(t("tweetNotFound"));

    const images = [];
    for (const image of tweet.images) {
      const stored = await readTweetImage(tabId, frameId, image.url, image.alt);
      if (stored) images.push(stored);
    }
    await saveCapturedTweetNote(imageNoteClient(settings), {
      notebookId: settings.notebookId,
      title: tweetNoteTitle({ ...tweet, fallback: t("tweetNoteFallbackTitle") }),
      displayName: tweet.displayName,
      handle: tweet.handle,
      text: tweet.text,
      quotedDisplayName: tweet.quotedDisplayName,
      quotedHandle: tweet.quotedHandle,
      quotedText: tweet.quotedText,
      datetime: tweet.datetime,
      statusUrl: tweet.statusUrl || canonicalStatusUrl(pageUrl) || pageUrl,
      images,
      capturedAt: new Date().toISOString(),
      sourceLabel: t("sourceLabel"),
      capturedAtLabel: t("capturedAtLabel"),
      timeLabel: t("tweetTimeLabel"),
      altFallback: t("imageAltFallback"),
    });
    await showFeedback(tabId, frameId, t("tweetSaved"), "success");
  } catch (error) {
    const message = describeTweetError(error);
    if (message === t("completePluginConfiguration") || message === t("instancePermissionRequired")) {
      await chrome.runtime.openOptionsPage();
    }
    await showFeedback(tabId, frameId, message, "error");
  }
};

const isCapturedPage = (value: unknown): value is CapturedPage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CapturedPage>;
  return typeof record.title === "string"
    && typeof record.url === "string"
    && typeof record.markdown === "string";
};

const readCapturedPage = async (tabId: number, frameId: number | null, mode: "page" | "selection") => {
  const result = await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCapture = null;
      reject(new Error(t("captureTimeout")));
    }, 15_000);
    pendingCapture = (page) => {
      clearTimeout(timeout);
      resolve(page);
    };
    const target = scriptTarget(tabId, frameId);
    const inject = async () => {
      await chrome.scripting.executeScript({
        target,
        func: (value: unknown) => {
          (globalThis as { __edgeeverPageClipPayload?: unknown }).__edgeeverPageClipPayload = value;
        },
        args: [{ mode }],
      });
      await chrome.scripting.executeScript({
        target,
        files: ["assets/capture.js"],
      });
    };
    void inject().catch((error: unknown) => {
      clearTimeout(timeout);
      pendingCapture = null;
      reject(new Error(describeCaptureError(error)));
    });
  });
  if (!isCapturedPage(result)) throw new Error(t("captureScriptFailed", t("captureUnknownError")));
  return result;
};

const describeSelectionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (
    message === t("completePluginConfiguration")
    || message === t("instancePermissionRequired")
    || message === t("noAvailableNotebooks")
    || message === t("selectionEmpty")
    || message === t("captureTimeout")
    || message === t("pageAccessDenied")
  ) {
    return message;
  }
  const captureScriptPrefix = t("captureScriptFailed", "\u0000").split("\u0000")[0] ?? "";
  if (captureScriptPrefix && message.startsWith(captureScriptPrefix)) return message;
  return describeSaveError(error);
};

const saveSelectionFromMenu = async (
  info: { pageUrl?: string; frameId?: number; selectionText?: string },
  tab?: { id?: number; url?: string; title?: string },
) => {
  const tabId = typeof tab?.id === "number" ? tab.id : null;
  const frameId = typeof info.frameId === "number" ? info.frameId : null;
  const pageUrl = tab?.url || info.pageUrl || "";
  const pageTitle = tab?.title || "";
  const browserSelection = (info.selectionText || "").replace(/\u00a0/g, " ").trim();
  try {
    const settings = await ensureClipperReady();
    if (!tabId) throw new Error(t("selectionEmpty"));
    await showFeedback(tabId, frameId, t("savingSelection"), "success");
    let captured: CapturedPage | null = null;
    try {
      captured = await readCapturedPage(tabId, frameId, "selection");
    } catch (error) {
      if (!browserSelection) throw error;
    }
    const fromSelection = captured?.kind === "selection" ? captured : null;
    const markdown = fromSelection?.markdown.trim() || browserSelection;
    const plain = fromSelection?.plainText?.trim() || browserSelection || markdown;
    if (!markdown.trim()) throw new Error(t("selectionEmpty"));
    await edgeEverRequest(settings, "/api/v1/memos", {
      method: "POST",
      body: JSON.stringify({
        notebookId: await notebookForClip(settings),
        title: selectionNoteTitle(plain, pageTitle, t("selectionNoteFallbackTitle")),
        contentMarkdown: selectionNoteMarkdown({
          markdown,
          pageUrl: fromSelection?.url || pageUrl,
          capturedAt: new Date().toISOString(),
          sourceLabel: t("sourceLabel"),
          capturedAtLabel: t("capturedAtLabel"),
        }),
        tags: ["web-clip"],
      }),
    });
    await showFeedback(tabId, frameId, t("selectionSaved"), "success");
  } catch (error) {
    const message = describeSelectionError(error);
    if (message === t("completePluginConfiguration") || message === t("instancePermissionRequired")) {
      await chrome.runtime.openOptionsPage();
    }
    await showFeedback(tabId, frameId, message, "error");
  }
};

const registerClipMenus = () => {
  // Chrome and Firefox fold an extension into a submenu when more than one of
  // its items is visible. These contexts stay disjoint so each command remains
  // on the top-level menu: a photo saves the image, selected words save the
  // passage, and the rest of an X post saves the post. Recreate from scratch
  // so a previous registration cannot keep an overlapping item.
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    createClipMenus();
  });
};

const createClipMenus = () => {
  chrome.contextMenus.create({
    id: SELECTION_MENU_ID,
    title: t("saveSelectionToEdgeEver"),
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  }, () => {
    void chrome.runtime.lastError;
  });
  chrome.contextMenus.create({
    id: IMAGE_MENU_ID,
    title: t("saveImageToEdgeEver"),
    contexts: ["image"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  }, () => {
    void chrome.runtime.lastError;
  });
  chrome.contextMenus.create({
    id: TWEET_MENU_ID,
    title: t("saveTweetToEdgeEver"),
    contexts: ["page", "video"],
    documentUrlPatterns: TWEET_DOCUMENT_PATTERNS,
  }, () => {
    void chrome.runtime.lastError;
  });
};

chrome.runtime.onInstalled.addListener(registerClipMenus);
registerClipMenus();

chrome.contextMenus.onClicked.addListener((info: { menuItemId?: string | number; srcUrl?: string; pageUrl?: string; frameId?: number; selectionText?: string }, tab?: { id?: number; url?: string; title?: string }) => {
  if (info.menuItemId === SELECTION_MENU_ID) {
    void enqueueClip(() => saveSelectionFromMenu(info, tab));
    return;
  }
  if (info.menuItemId === IMAGE_MENU_ID) {
    void enqueueClip(() => saveImageFromMenu(info, tab));
    return;
  }
  if (info.menuItemId === TWEET_MENU_ID) {
    void enqueueClip(() => saveTweetFromMenu(info, tab));
  }
});

chrome.windows.onRemoved.addListener((windowId: number) => {
  void chrome.storage.session.get([IMAGE_SAVE_WINDOW_KEY, TWEET_WINDOW_KEY]).then((stored: Record<string, unknown>) => {
    if (stored[IMAGE_SAVE_WINDOW_KEY] === windowId) {
      void chrome.storage.session.remove(IMAGE_SAVE_WINDOW_KEY);
    }
    if (stored[TWEET_WINDOW_KEY] === windowId) {
      void chrome.storage.session.remove(TWEET_WINDOW_KEY);
    }
  }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: { type?: string; page?: CapturedPage; requestId?: string; result?: unknown }, _sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === "capturedPage" && message.page) {
    pendingCapture?.(message.page);
    pendingCapture = null;
    return false;
  }

  if (message.type === "pageImageRead" && message.requestId) {
    pendingImageReads.get(message.requestId)?.(message.result);
    pendingImageReads.delete(message.requestId);
    return false;
  }

  if (message.type === "pageTweetRead" && message.requestId) {
    pendingTweetReads.get(message.requestId)?.(message.result);
    pendingTweetReads.delete(message.requestId);
    return false;
  }

  if (message.type === "activateTweetTarget") {
    void (async () => {
      const stored = await chrome.storage.session.get(PENDING_TWEET_KEY);
      const pending = stored[PENDING_TWEET_KEY] as { tabId?: number | null } | undefined;
      if (typeof pending?.tabId === "number") {
        try {
          await injectTweetTarget(pending.tabId);
        } catch {
          // The tab can be saved on the next right-click after it reloads.
        }
      }
      await chrome.storage.session.remove(PENDING_TWEET_KEY);
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "getPendingImageSave") {
    void readPendingImageSave().then((pending) => {
      sendResponse(pending ? { originPattern: pending.originPattern, host: pending.host } : null);
    }, () => sendResponse(null));
    return true;
  }

  if (message.type === "completePendingImageSave") {
    if (completingImageSave) {
      sendResponse({ ok: false, message: t("savingImage") });
      return false;
    }
    completingImageSave = true;
    void (async () => {
      const pending = await readPendingImageSave();
      if (!pending) {
        sendResponse({ ok: false, message: t("imageSaveExpired") });
        return;
      }
      try {
        await showFeedback(pending.tabId, pending.frameId, t("savingImage"), "success");
        await saveDownloadedImage(pending, "");
        sendResponse({ ok: true });
      } catch (error) {
        const message = describeImageError(error);
        await showFeedback(pending.tabId, pending.frameId, message, "error");
        sendResponse({ ok: false, message });
      }
    })().catch((error: unknown) => {
      sendResponse({ ok: false, message: describeImageError(error) });
    }).finally(() => {
      completingImageSave = false;
    });
    return true;
  }

  if (message.type === "testConnection") {
    void (async () => {
      try {
        const settings = await getSettings();
        const notebooks = await listNotebooks(settings);
        sendResponse({ ok: true, notebooks: notebooks.notebooks });
      } catch (error) {
        sendResponse({ ok: false, message: error instanceof Error ? error.message : t("connectionFailed") });
      }
    })();
    return true;
  }

  if (message.type === "captureCurrentPage") {
    void (async () => {
      try {
        const settings = await getSettings();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          throw new Error(t("currentPageNotFound"));
        }

        const page = await readCapturedPage(tab.id, null, "page");
        await createMemo(settings, page);
        sendResponse({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        sendResponse({
          ok: false,
          message: message === t("captureTimeout") || message.startsWith(t("captureScriptFailed", ""))
            ? describeCaptureError(error)
            : describeSaveError(error),
        });
      }
    })();
    return true;
  }

  return false;
});
