export const writeTextClipboard = async (clipboard, value) => {
  if (typeof value !== "string") {
    throw new TypeError("Clipboard value must be a string");
  }

  await clipboard.writeText(value);
  return await clipboard.readText() === value;
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
