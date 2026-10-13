export const PICGO_STORAGE_KEY = "edgeever.desktop.picgo.v1";
export const DEFAULT_PICGO_ENDPOINT = "http://127.0.0.1:36677/upload";
export type PicGoPreference = { provider: "edgeever" | "picgo"; endpoint: string };

export const readPicGoPreference = (): PicGoPreference => {
  const fallback: PicGoPreference = { provider: "edgeever", endpoint: DEFAULT_PICGO_ENDPOINT };
  try {
    const value = JSON.parse(window.localStorage.getItem(PICGO_STORAGE_KEY) ?? "null");
    if (!value || typeof value.endpoint !== "string") return fallback;
    return { provider: value.provider === "picgo" ? "picgo" : "edgeever", endpoint: value.endpoint };
  } catch { return fallback; }
};

export const writePicGoPreference = (value: PicGoPreference) => {
  // Fail visibly when persistence is unavailable; never claim a provider changed.
  window.localStorage.setItem(PICGO_STORAGE_KEY, JSON.stringify(value));
};

export const hasPicGoBridge = () => Boolean(window.edgeeverDesktop?.uploadPicGoImage && window.edgeeverDesktop?.testPicGoConnection);

export const shouldUploadWithPicGo = () => hasPicGoBridge() && readPicGoPreference().provider === "picgo";

export type PicGoFailureCopy = { title: string; message: string; retry: string; fallback: string; cancel: string };

export const uploadImageWithPicGo = async (file: File, copy: PicGoFailureCopy) => {
  const preference = readPicGoPreference();
  if (preference.provider !== "picgo" || !hasPicGoBridge()) return null;
  const result = await window.edgeeverDesktop!.uploadPicGoImage({
    endpoint: preference.endpoint, bytes: new Uint8Array(await file.arrayBuffer()),
    filename: file.name, mimeType: file.type, copy,
  });
  return "url" in result ? {
    kind: "image" as const, url: result.url, filename: file.name, mimeType: file.type, byteSize: file.size,
  } : null;
};
