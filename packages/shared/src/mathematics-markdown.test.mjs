import { describe, expect, test } from "bun:test";
import {
  findInlineMathSpans,
  matchBlockMathText,
  matchInlineMathSuffix,
} from "./mathematics-markdown.ts";

describe("math delimiter recognition", () => {
  test("reads an inline formula that ends at the caret", () => {
    expect(matchInlineMathSuffix("Euler $e^{i\\pi}+1=0$")).toEqual({
      index: 6,
      raw: "$e^{i\\pi}+1=0$",
      latex: "e^{i\\pi}+1=0",
    });
  });

  test("leaves currency pairs as text and still finds a later formula", () => {
    const text = "Price $100$ and $12.50$, then $x$";
    expect(findInlineMathSpans(text)).toEqual([
      { index: text.lastIndexOf("$x$"), raw: "$x$", latex: "x" },
    ]);
    expect(matchInlineMathSuffix("$100$")).toBeNull();
    expect(matchInlineMathSuffix("$12,50$")).toBeNull();
  });

  test("does not treat double dollars as inline math", () => {
    expect(findInlineMathSpans("hello $$x$$")).toEqual([]);
    expect(matchInlineMathSuffix("hello $$x$$")).toBeNull();
    expect(matchInlineMathSuffix("$$c+d$")).toBeNull();
    expect(matchInlineMathSuffix("$$c+d$$")).toBeNull();
    expect(matchBlockMathText("hello $$x$$")).toBeNull();
  });

  test("reads a display formula only when it occupies the paragraph", () => {
    expect(matchBlockMathText("$$c+d$$")).toEqual({ latex: "c+d" });
    expect(matchBlockMathText("  $$ c + d $$  ")).toEqual({ latex: "c + d" });
    expect(matchBlockMathText("$$$c$$$")).toBeNull();
    expect(matchBlockMathText("$$ $$")).toBeNull();
  });
});
