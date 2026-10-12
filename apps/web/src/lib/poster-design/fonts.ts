import { POSTER_FONTS } from "@edgeever/shared";
export { POSTER_FONTS };
const loads = new Map<string, Promise<void>>();
export function loadPosterFont(family: string) {
  const font = POSTER_FONTS.find((entry) => entry.family === family);
  if (!font) return Promise.resolve();
  if (!loads.has(family)) {
    const face = new FontFace(
      family,
      `url("/poster-fonts/${font.file}.${font.file === "douyin" ? "ttf" : "woff2"}")`,
    );
    const promise = face
      .load()
      .then((loaded) => {
        window.document.fonts.add(loaded);
      })
      .catch((error) => {
        loads.delete(family);
        throw error;
      });
    loads.set(family, promise);
  }
  return loads.get(family)!;
}
export const loadDesignFonts = (zh: boolean) =>
  Promise.all(
    (zh
      ? [
          "思源黑体",
          "思源黑体 Heavy",
          "思源宋体",
          "思源宋体 Heavy",
          "得意黑",
          "霞鹜文楷",
          "抖音美好体",
          "马善政楷书",
          "江城圆体",
          "站酷庆科黄油体",
          "未来荧黑",
          "朱雀仿宋",
          "站酷快乐体",
          "DM Serif Display",
          "Anton",
        ]
      : ["Inter", "DM Serif Display", "Bebas Neue", "Space Grotesk"]
    ).map(loadPosterFont),
  );
