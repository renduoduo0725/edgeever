import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoAttachmentPlayer } from "./VideoAttachmentPlayer.tsx";

describe("VideoAttachmentPlayer", () => {
  test("uses the native streaming player without eagerly downloading the file", () => {
    const markup = renderToStaticMarkup(createElement(VideoAttachmentPlayer, {
      src: "/api/v1/resources/video-1/blob",
      label: "walkthrough.mp4",
      unavailableMessage: "Unavailable",
    }));

    expect(markup).toContain("<video");
    expect(markup).toContain('preload="metadata"');
    expect(markup).toContain("playsInline");
    expect(markup).toContain('src="/api/v1/resources/video-1/blob"');
    expect(markup).toContain('aria-label="walkthrough.mp4"');
    expect(markup).toContain("data-edgeever-video-player");
  });
});
