import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PUBLISH_LAYOUT_ORNAMENTS,
  PUBLISH_ORNAMENT_IDS,
  publishOrnamentCssVars,
  publishOrnamentDataUri,
  renderPublishOrnamentSvg,
} from "./publish-ornaments.ts";

describe("publish ornaments", () => {
  test("renders original tintable stationery marks", () => {
    expect(PUBLISH_ORNAMENT_IDS).toEqual([
      "blossom",
      "sprig",
      "sun",
      "tape",
      "quote",
      "brush",
      "swoosh",
      "leaf",
    ]);
    const svg = renderPublishOrnamentSvg("blossom", "#D9A521");
    expect(svg).toContain("#D9A521");
    expect(svg).not.toContain("{{color}}");
    expect(svg).toContain("<svg");
    expect(publishOrnamentDataUri("tape", "#E3A321")).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  test("keeps letter, grove, and stub on the original ornament set", () => {
    expect(PUBLISH_LAYOUT_ORNAMENTS.letter).toEqual({
      titleEnd: "sprig",
      titleRule: "brush",
      chapterMark: "blossom",
      chapterEnd: "sun",
      quoteMark: "quote",
      quoteTape: "tape",
    });
    expect(PUBLISH_LAYOUT_ORNAMENTS.grove.headingRule).toBe("swoosh");
    expect(PUBLISH_LAYOUT_ORNAMENTS.stub.quoteTape).toBe("tape");
  });

  test("exposes mask URLs for the writing canvas", () => {
    const vars = publishOrnamentCssVars();
    expect(vars["--publish-ornament-brush"]).toContain("url(\"data:image/svg+xml");
    expect(vars["--publish-ornament-sun"]).toContain("url(\"data:image/svg+xml");
  });
});

describe("ornament wiring", () => {
  test("paper layout and WeChat copy inject and rasterize ornaments", () => {
    const layout = readFileSync(new URL("./publish-layout.ts", import.meta.url), "utf8");
    const wechat = readFileSync(new URL("./wechat-copy.ts", import.meta.url), "utf8");
    const css = readFileSync(new URL("../styles/publish-layout.css", import.meta.url), "utf8");

    expect(layout).toContain("chromeOrnament");
    expect(layout).toContain("publishOrnamentCssVars");
    expect(layout).toContain("data-ee-publish-ornament");
    expect(wechat).toContain("rasterizePublishOrnamentsForWeChat");
    expect(wechat).toContain("image/png");
    expect(css).toContain("--publish-ornament-brush");
    expect(css).toContain("--publish-ornament-tape");
    expect(css).toContain("--publish-ornament-sprig");
  });
});
