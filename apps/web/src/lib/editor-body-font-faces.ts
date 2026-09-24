import fangsongUrl from "../assets/fonts/editor-body/fangsong.woff2?url";
import heiUrl from "../assets/fonts/editor-body/hei.woff2?url";
import kaiScreenUrl from "../assets/fonts/editor-body/kai-screen.woff2?url";
import kaiUrl from "../assets/fonts/editor-body/kai.woff2?url";
import songUrl from "../assets/fonts/editor-body/song.woff2?url";
import sourceSerifUrl from "../assets/fonts/editor-body/source-serif-4-regular.woff2?url";
import zhiSongUrl from "../assets/fonts/editor-body/zhi-song.woff2?url";

const FONT_FACE_STYLE_ID = "edgeever-editor-body-fonts";

const fontFace = (family: string, url: string) => `@font-face {
  font-family: "${family}";
  src: url("${url}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;

const FONT_FACE_CSS = [
  fontFace("EdgeEver Kai", kaiUrl),
  fontFace("EdgeEver Kai Screen", kaiScreenUrl),
  fontFace("EdgeEver Fangsong", fangsongUrl),
  fontFace("EdgeEver Song", songUrl),
  fontFace("EdgeEver Zhi Song", zhiSongUrl),
  fontFace("EdgeEver Hei", heiUrl),
  fontFace("Source Serif 4", sourceSerifUrl),
].join("\n");

export const installEditorBodyFontFaces = () => {
  if (typeof document === "undefined" || document.getElementById(FONT_FACE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FONT_FACE_STYLE_ID;
  style.textContent = FONT_FACE_CSS;
  document.head.appendChild(style);
};
