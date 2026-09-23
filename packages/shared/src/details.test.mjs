import { describe, expect, test } from "bun:test";
import { DETAILS_EDITOR_CSS, flattenDetailsForLinearHtml, wrapDetailsContentHtml } from "./details.ts";

describe("details HTML helpers", () => {
  test("wraps GitHub details bodies for the TipTap schema", () => {
    if (typeof DOMParser === "undefined") return;

    const wrapped = wrapDetailsContentHtml(
      `<details><summary>图</summary><img src="https://example.com/a.png" alt="pic"></details>`,
    );
    expect(wrapped).toContain('data-type="detailsContent"');
    expect(wrapped).toContain("<summary>图</summary>");
    expect(wrapped).toContain('src="https://example.com/a.png"');
  });

  test("pastes a remote video inside details as an attachment the player already knows", () => {
    if (typeof DOMParser === "undefined") return;

    const wrapped = wrapDetailsContentHtml(
      `<details><summary>片段</summary><video src="https://cdn.example.com/clip.mp4" controls width="45%"></video></details>`,
    );
    expect(wrapped).toContain('data-type="edgeever-file-attachment"');
    expect(wrapped).toContain('data-file-url="https://cdn.example.com/clip.mp4"');
    expect(wrapped).toContain('data-file-mime-type="video/mp4"');
    expect(wrapped).not.toContain("<video");
    expect(wrapped).not.toContain("width=\"45%\"");
  });

  test("unwraps details to a visible title for linear HTML sinks", () => {
    if (typeof DOMParser === "undefined") return;

    const root = new DOMParser().parseFromString(
      `<details><summary>提示</summary><div data-type="detailsContent"><p>hidden</p></div></details>`,
      "text/html",
    ).body;
    flattenDetailsForLinearHtml(root);
    expect(root.querySelector("details")).toBeNull();
    expect(root.textContent).toContain("提示");
    expect(root.textContent).toContain("hidden");
  });
});

describe("details editor chrome", () => {
  test("keeps a collapsed fold as a disclosure line instead of a filled card", () => {
    expect(DETAILS_EDITOR_CSS).toContain("width: 1.6em");
    expect(DETAILS_EDITOR_CSS).toContain("height: 1.6em");
    expect(DETAILS_EDITOR_CSS).toContain("align-items: center");
    expect(DETAILS_EDITOR_CSS).toContain("justify-content: center");
    expect(DETAILS_EDITOR_CSS).toContain("display: none !important");
    expect(DETAILS_EDITOR_CSS).toContain("font-weight: 500");
    expect(DETAILS_EDITOR_CSS).not.toContain("border-radius: 10px");
    expect(DETAILS_EDITOR_CSS).not.toContain("border-left: 2px solid");
  });
});
