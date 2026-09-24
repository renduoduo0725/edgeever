export const writeTextClipboard = async (clipboard, value) => {
  if (typeof value !== "string") {
    throw new TypeError("Clipboard value must be a string");
  }

  await clipboard.writeText(value);
  return await clipboard.readText() === value;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_IMAGE_CLIPBOARD_BYTES = 32 * 1024 * 1024;

const pngBytes = (value) => {
  let bytes = null;
  if (value instanceof Uint8Array) bytes = value;
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else if (value && value.type === "Buffer" && Array.isArray(value.data)) bytes = Uint8Array.from(value.data);
  else throw new TypeError("Clipboard image must be PNG bytes");

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_CLIPBOARD_BYTES) return null;
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return null;
  }
  return bytes;
};

export const writeImageClipboard = async (clipboard, ClipboardItem, value) => {
  const bytes = pngBytes(value);
  if (!bytes) return false;

  await clipboard.write([new ClipboardItem({
    "image/png": new Blob([bytes], { type: "image/png" }),
  })]);
  return await clipboard.has("image/png");
};

export const writeRichClipboard = async (clipboard, ClipboardItem, input) => {
  const html = input?.html;
  const plainText = input?.plainText;
  if (typeof html !== "string" || typeof plainText !== "string") {
    throw new TypeError("Clipboard HTML and plain text must be strings");
  }

  await clipboard.write([new ClipboardItem({
    "text/html": html,
    "text/plain": plainText,
  })]);
  const [copiedText, hasHtml] = await Promise.all([
    clipboard.readText(),
    clipboard.has("text/html"),
  ]);
  return copiedText === plainText && hasHtml;
};
