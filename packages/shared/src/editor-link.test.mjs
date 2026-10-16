import { describe, expect, test } from "bun:test";
import { getExtensionField, getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { EdgeEverLink } from "./editor-link.ts";

const schema = getSchema([
  StarterKit.configure({ link: false }),
  EdgeEverLink,
]);

describe("EdgeEverLink", () => {
  function pastedLinks(text, extension = EdgeEverLink) {
    const rules = getExtensionField(extension, "addPasteRules", {
      name: "link",
      options: extension.options,
      type: schema.marks.link,
    })();
    return rules.flatMap(rule => rule.find(text)).map(match => ({
      text: match.text,
      index: match.index,
      href: match.data.href,
    }));
  }

  test("pasting the reported sentence links only the domain", () => {
    const text = "我让他先去refero.design挑选参考样子，然后apple-design skill落地，品质线是获奖级——Awwwards / Webby / FWA 那个水准，交付前自我检查，不达标就反复打磨，不许一版交差。";
    expect(pastedLinks(text)).toEqual([
      { text: "refero.design", index: 5, href: "http://refero.design" },
    ]);
  });

  test.each([
    ["先看参考refero.design", "refero.design"],
    ["参考はrefero.design", "refero.design"],
    ["참고refero.design", "refero.design"],
    ["查看www.example.com/path?q=中文", "www.example.com/path?q=中文"],
    ["看看foo中文sub.example.com", "sub.example.com"],
  ])("keeps adjacent prose outside a pasted bare URL: %s", (text, url) => {
    expect(pastedLinks(text)).toEqual([
      { text: url, index: text.indexOf(url), href: `http://${url}` },
    ]);
  });

  test.each([
    "https://example.com/中文",
    "https://中文example.com/path",
    "例子.中国",
    "user@example.com",
    "中文user@example.com",
    "example.com/path?q=中文",
  ])("preserves URLs and email addresses: %s", text => {
    expect(pastedLinks(text)[0]).toMatchObject({ text, index: 0 });
  });

  test("keeps positions correct for multiple links and non-BMP text", () => {
    const text = "😀先看refero.design，再看example.com。";
    expect(pastedLinks(text)).toEqual([
      { text: "refero.design", index: text.indexOf("refero"), href: "http://refero.design" },
      { text: "example.com", index: text.indexOf("example"), href: "http://example.com" },
    ]);
  });

  test("retains configured URL validation after removing prose", () => {
    expect(pastedLinks("先看refero.design", EdgeEverLink.configure({
      shouldAutoLink: url => !url.startsWith("refero"),
    }))).toEqual([]);
  });

  test("preserves explicit Markdown link labels", () => {
    const text = "[我让他先去refero.design](https://example.com)";
    expect(pastedLinks(text, EdgeEverLink.configure({ markdownLinks: true }))).toEqual([
      { text, index: 0, href: "https://example.com" },
    ]);
  });

  test("does not extend a terminal link into subsequently entered text", () => {
    const link = schema.marks.link.create({ href: "https://example.com" });
    const paragraph = schema.nodes.paragraph.create(null, schema.text("linked", [link]));
    let state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [paragraph]),
    });

    state = state.apply(
      state.tr
        .setSelection(TextSelection.atEnd(state.doc))
        .insertText(" after"),
    );

    expect(state.doc.toJSON().content[0].content).toEqual([
      {
        type: "text",
        marks: [{
          type: "link",
          attrs: {
            href: "https://example.com",
            target: "_blank",
            rel: "noopener noreferrer nofollow",
            class: null,
            title: null,
          },
        }],
        text: "linked",
      },
      { type: "text", text: " after" },
    ]);
  });

  test("retains TipTap's automatic linking features", () => {
    expect(EdgeEverLink.options.autolink).toBe(true);
    expect(EdgeEverLink.options.linkOnPaste).toBe(true);
  });
});
