import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approximateMeasurer,
  clearTextCaches,
  layoutText,
  plainText,
  setTextMeasurer,
} from "../src/text-layout.ts";
import { emMeasurer } from "./fake-canvas.ts";

const F = "400 10px sans-serif";
const EM = "700 10px sans-serif";
const lineText = (layout: ReturnType<typeof layoutText>) =>
  layout.lines.map((l) => l.tokens.map((t) => t.s).join(""));

describe("layoutText", () => {
  beforeEach(() => setTextMeasurer(emMeasurer));
  afterEach(() => setTextMeasurer(null));

  it("wraps Japanese per character at maxWidth", () => {
    const layout = layoutText("あいうえおかきくけこ", F, EM, 40);
    expect(lineText(layout)).toEqual(["あいうえ", "おかきく", "けこ"]);
    expect(layout.chars).toBe(10);
    expect(layout.width).toBe(40);
  });

  it("hangs line-start-forbidden characters on the previous line (禁則)", () => {
    expect(lineText(layoutText("あいうえ。お", F, EM, 40))).toEqual(["あいうえ。", "お"]);
  });

  it("keeps Latin words whole and drops the space at a break", () => {
    expect(lineText(layoutText("AI-DLC workflow", F, EM, 100))).toEqual(["AI-DLC", "workflow"]);
  });

  it("trims trailing spaces before an explicit newline", () => {
    const layout = layoutText("ab  \ncd", F, EM, 1000);
    expect(lineText(layout)).toEqual(["ab", "cd"]);
    expect(layout.lines[0]?.width).toBe(20);
  });

  it("marks **emphasis** and measures it with the emphasis font", () => {
    const measure = vi.fn(emMeasurer);
    setTextMeasurer(measure);
    const layout = layoutText("a**b**c", F, EM, 1000);
    expect(layout.lines[0]?.tokens.map((t) => [t.s, t.em])).toEqual([
      ["a", false],
      ["b", true],
      ["c", false],
    ]);
    expect(measure).toHaveBeenCalledWith(EM, "b");
  });

  it("caches layouts and widths until cleared", () => {
    const measure = vi.fn(emMeasurer);
    setTextMeasurer(measure);
    const first = layoutText("キャッシュ", F, EM, 1000);
    expect(layoutText("キャッシュ", F, EM, 1000)).toBe(first);
    const calls = measure.mock.calls.length;
    layoutText("キャッシュ", F, EM, 999);
    expect(measure.mock.calls.length).toBe(calls);
    clearTextCaches();
    expect(layoutText("キャッシュ", F, EM, 1000)).not.toBe(first);
  });

  it("plainText strips emphasis markers", () => {
    expect(plainText("**強調**と通常")).toBe("強調と通常");
  });
});

describe("default measurer", () => {
  afterEach(() => setTextMeasurer(null));

  it("approximates full-width as one em and the rest as about half", () => {
    expect(approximateMeasurer("20px x", "あa")).toBeCloseTo(20 + 11);
    expect(approximateMeasurer("bold serif", "a")).toBeCloseTo(16 * 0.55);
  });

  it("falls back to the approximation where no canvas exists (Node)", () => {
    setTextMeasurer(null);
    expect(layoutText("あいう", "400 10px x", "400 10px x", 1000).width).toBe(30);
  });
});
