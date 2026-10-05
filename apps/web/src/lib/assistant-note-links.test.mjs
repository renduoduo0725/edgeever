import { describe, expect, test } from "bun:test";
import { parseAssistantNoteLinkHref } from "./assistant-note-links.ts";

const id = "memo_328cb20d4b4040edb3ecb24638abc2d5";

describe("assistant note links", () => {
  test("recognizes a workspace hash and the legacy EdgeEver note URL", () => {
    expect(parseAssistantNoteLinkHref(`#memo=${id}`)).toBe(id);
    expect(parseAssistantNoteLinkHref(`https://edgeever.ai/memo/${id}`)).toBe(id);
    expect(parseAssistantNoteLinkHref(`https://edgeever.ai/memo/${id}/`)).toBe(id);
  });

  test("leaves external and ambiguous URLs external", () => {
    expect(parseAssistantNoteLinkHref(`https://other.example/memo/${id}`)).toBeNull();
    expect(parseAssistantNoteLinkHref(`https://edgeever.ai.evil.example/memo/${id}`)).toBeNull();
    expect(parseAssistantNoteLinkHref(`http://edgeever.ai/memo/${id}`)).toBeNull();
    expect(parseAssistantNoteLinkHref(`https://edgeever.ai/memo/${id}?workspace=other`)).toBeNull();
    expect(parseAssistantNoteLinkHref("https://edgeever.ai/memo/not-a-note-id")).toBeNull();
  });
});
