// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageNode, Text } from "../src/shapes.ts";
import { Stage } from "../src/stage.ts";
import { layoutText, setTextMeasurer } from "../src/text-layout.ts";
import { callsNamed, fakeCanvas, fakeContext } from "./fake-canvas.ts";

afterEach(() => {
  setTextMeasurer(null);
  vi.restoreAllMocks();
});

describe("in a page", () => {
  it("measures text with a real 2D context when one exists", () => {
    const ctx = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as RenderingContext,
    );
    setTextMeasurer(null);
    expect(layoutText("abc", "400 10px x", "400 10px x", 1000).width).toBe(30);
    expect(callsNamed(ctx, "set:font")[0]?.args).toEqual(["400 10px x"]);
  });

  it("falls back to the estimate when the canvas has no 2D context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    setTextMeasurer(null);
    expect(layoutText("あ", "400 10px x", "400 10px x", 1000).width).toBe(10);
  });

  it("falls back to the estimate when creating a canvas throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked");
    });
    setTextMeasurer(null);
    expect(layoutText("あ", "400 10px x", "400 10px x", 1000).width).toBe(10);
  });

  it("loads an image from a URL and draws it once loaded", async () => {
    const node = new ImageNode({ src: "data:image/png;base64,AAAA", w: 4, h: 4 });
    const ctx = fakeContext();
    node.render(ctx, 0);
    expect(callsNamed(ctx, "drawImage")).toHaveLength(0);
    const img = (node as unknown as { img: HTMLImageElement }).img;
    img.onload?.(new Event("load"));
    await node.ready;
    node.render(ctx, 0);
    expect(callsNamed(ctx, "drawImage")).toHaveLength(1);
  });

  it("settles ready when an image fails", async () => {
    const node = new ImageNode({ src: "data:," });
    const img = (node as unknown as { img: HTMLImageElement }).img;
    img.onerror?.(new Event("error"));
    await expect(node.ready).resolves.toBeUndefined();
  });

  it("preloads every font with the text it draws, then redraws", async () => {
    const load = vi.fn(async (_font: string, _text: string) => [] as FontFace[]);
    Object.defineProperty(document, "fonts", { value: { load }, configurable: true });
    try {
      const canvas = fakeCanvas();
      const stage = new Stage(canvas, { captionStyle: { size: 30, weight: 500, family: "Cap" } });
      const scene = stage.scene("s");
      scene.add(new Text({ text: "**強調**", size: 20, weight: 400, emWeight: 700, family: "F" }));
      scene.add(new Text({ text: "同じ", size: 20, weight: 400, family: "F" }));
      scene.caption("**字幕**", 0, 1);
      stage.overlay.add(new Text({ text: "上", size: 10, family: "O" }));
      load.mockRejectedValueOnce(new Error("offline"));
      canvas.ctx.reset();
      await stage.loadFonts();
      const requested = new Map(load.mock.calls.map((c) => [c[0], c[1]]));
      expect(requested.get("400 20px F")).toBe("強調0123456789%同じ0123456789%");
      expect(requested.get("700 20px F")).toBe("強調");
      expect(requested.get("400 10px O")).toBe("上0123456789%");
      expect(requested.get("500 30px Cap")).toBe("字幕");
      expect(callsNamed(canvas.ctx, "fillRect").length).toBeGreaterThan(0);
    } finally {
      Reflect.deleteProperty(document, "fonts");
    }
  });
});
