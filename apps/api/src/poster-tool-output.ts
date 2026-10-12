// Only the dedicated read/export tools can emit a visual tool result. The API
// has already checked workspace ownership and resource scopes before reading it.
export function posterToolImage(name: string, output: unknown) {
  if (name !== "get_poster_preview" && name !== "export_poster") return null;
  if (!output || typeof output !== "object") return null;
  const result = output as Record<string, unknown>;
  const image = result.image as { data?: unknown; mimeType?: unknown } | undefined;
  if (result.available !== true || !image || typeof image.data !== "string" || typeof image.mimeType !== "string"
    || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) return null;
  const { image: _image, ...metadata } = result;
  return { image: { data: image.data, mimeType: image.mimeType }, metadata };
}
