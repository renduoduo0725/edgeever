type ClipboardReader = Partial<Pick<Clipboard, "read" | "readText">>;

export type TableClipboardContent = { html: string; text: string; images: File[] };

/** Prefer rich text, then plain text, then image uploads, as with a normal paste. */
export const readTableClipboard = async (clipboard: ClipboardReader | undefined): Promise<TableClipboardContent> => {
  if (!clipboard?.read) {
    if (!clipboard?.readText) throw new Error("Clipboard read unavailable");
    return { html: "", text: await clipboard.readText(), images: [] };
  }
  const items = await clipboard.read();
  let error: unknown;
  const readTextType = async (type: string) => {
    const parts: string[] = [];
    for (const item of items) {
      if (!item.types.includes(type)) continue;
      try {
        parts.push(await (await item.getType(type)).text());
      } catch (cause) {
        error = cause;
      }
    }
    return parts.join(type === "text/plain" ? "\n" : "");
  };
  const html = await readTextType("text/html");
  if (html) return { html, text: "", images: [] };
  const text = await readTextType("text/plain");
  if (text) return { html: "", text, images: [] };
  const images: File[] = [];
  for (const item of items) {
    for (const type of item.types.filter((type) => type.startsWith("image/"))) {
      images.push(new File([await item.getType(type)], `clipboard.${type.split("/")[1]}`, { type }));
    }
  }
  if (!images.length && error) throw error;
  return { html: "", text: "", images };
};
