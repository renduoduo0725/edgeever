import { isAllowedAppNavigation } from "./window-open-policy.mjs";

const MAX_TEXT_CLIPBOARD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_CLIPBOARD_BYTES = 32 * 1024 * 1024;

/** Return only editor paste formats; never forward OS clipboard/file/bookmark formats. */
export const readEditorClipboard = async (clipboard) => {
  const items = await clipboard.read();
  let error;
  const readText = async (type) => {
    let bytes = 0;
    const parts = [];
    for (const item of items) {
      if (!item.types.includes(type)) continue;
      const blob = await item.getType(type);
      bytes += blob.size;
      if (bytes > MAX_TEXT_CLIPBOARD_BYTES) throw new RangeError("Clipboard text exceeds size limit");
      parts.push(await blob.text());
    }
    return parts.join(type === "text/plain" ? "\n" : "");
  };
  for (const type of ["text/html", "text/plain"]) {
    try {
      const value = await readText(type);
      if (value) return { html: type === "text/html" ? value : "", text: type === "text/plain" ? value : "", images: [] };
    } catch (cause) { error = cause; }
  }
  const images = [];
  let imageBytes = 0;
  for (const item of items) {
    if (!item.types.includes("image/png")) continue;
    const blob = await item.getType("image/png");
    imageBytes += blob.size;
    if (imageBytes > MAX_IMAGE_CLIPBOARD_BYTES) throw new RangeError("Clipboard images exceed size limit");
    if (blob.size) images.push(new Uint8Array(await blob.arrayBuffer()));
  }
  if (!images.length && error) throw error;
  return { html: "", text: "", images };
};

/** Explicit paste reads require the focused app's main frame before and after the async snapshot. */
export const registerClipboardReadIpc = (ipcMain, { clipboard, getMainWindow, getRendererUrl }) => {
  const authorize = (event) => {
    const window = getMainWindow();
    const sender = event?.sender;
    if (!window || window.isDestroyed()
      || sender !== window.webContents || sender.isDestroyed()
      || event.senderFrame !== sender.mainFrame
      || !window.isVisible() || window.isMinimized()
      || !window.isFocused() || !sender.isFocused()
      || !isAllowedAppNavigation(event.senderFrame.url, getRendererUrl())) {
      throw new Error("Clipboard read forbidden");
    }
  };
  ipcMain.handle("desktop:read-clipboard", async (event, ...args) => {
    if (args.length !== 0) throw new Error("Clipboard read forbidden");
    authorize(event);
    const snapshot = await readEditorClipboard(clipboard);
    authorize(event);
    return snapshot;
  });
};
