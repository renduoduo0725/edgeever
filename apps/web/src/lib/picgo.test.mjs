import { afterEach, expect, test } from "bun:test";
import { PICGO_STORAGE_KEY, DEFAULT_PICGO_ENDPOINT, readPicGoPreference, shouldUploadWithPicGo, uploadImageWithPicGo, writePicGoPreference } from "./picgo.ts";

const previousWindow = globalThis.window;
afterEach(() => {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});
const setup = (upload) => {
  const storage = new Map();
  globalThis.window = {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    edgeeverDesktop: upload ? { uploadPicGoImage: upload, testPicGoConnection: async () => true } : undefined,
  };
  return storage;
};
const copy = { title: "Failed", message: "Retry?", retry: "Retry", fallback: "EdgeEver", cancel: "Cancel" };
const file = () => new File([new Uint8Array([137, 80, 78, 71])], "image.png", { type: "image/png" });

test("default, corrupt settings and ordinary Web runtime retain attachment uploads", async () => {
  const storage = setup();
  expect(readPicGoPreference()).toEqual({ provider: "edgeever", endpoint: DEFAULT_PICGO_ENDPOINT });
  storage.set(PICGO_STORAGE_KEY, "corrupt");
  expect(shouldUploadWithPicGo()).toBe(false);
  writePicGoPreference({ provider: "picgo", endpoint: DEFAULT_PICGO_ENDPOINT });
  expect(shouldUploadWithPicGo()).toBe(false);
  expect(await uploadImageWithPicGo(file(), copy)).toBeNull();
});

test("configured but disabled PicGo never sends an image", async () => {
  setup(() => { throw new Error("Should not upload"); });
  writePicGoPreference({ provider: "edgeever", endpoint: DEFAULT_PICGO_ENDPOINT });
  expect(shouldUploadWithPicGo()).toBe(false);
  expect(await uploadImageWithPicGo(file(), copy)).toBeNull();
});

test("enabled PicGo passes actual bytes and returns an external image for either editor mode", async () => {
  setup(async (input) => {
    expect(input.endpoint).toBe(DEFAULT_PICGO_ENDPOINT);
    expect(input.bytes).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(input.copy).toEqual(copy);
    return { url: "https://images.example.com/image.png" };
  });
  writePicGoPreference({ provider: "picgo", endpoint: DEFAULT_PICGO_ENDPOINT });
  expect(shouldUploadWithPicGo()).toBe(true);
  expect(await uploadImageWithPicGo(file(), copy)).toEqual({
    kind: "image", url: "https://images.example.com/image.png", filename: "image.png", mimeType: "image/png", byteSize: 4,
  });
});

test("only explicit fallback returns to attachment storage; cancellation stays a failure", async () => {
  setup(async () => ({ fallback: true }));
  writePicGoPreference({ provider: "picgo", endpoint: DEFAULT_PICGO_ENDPOINT });
  expect(await uploadImageWithPicGo(file(), copy)).toBeNull();
  window.edgeeverDesktop.uploadPicGoImage = async () => { throw new Error("Cancelled"); };
  await expect(uploadImageWithPicGo(file(), copy)).rejects.toThrow("Cancelled");
});
