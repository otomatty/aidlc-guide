import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Rect } from "../src/shapes.ts";
import { Stage, type StageCue } from "../src/stage.ts";
import { setTextMeasurer } from "../src/text-layout.ts";
import { callsNamed, emMeasurer, fakeCanvas } from "./fake-canvas.ts";

function twoChapterStage() {
  const canvas = fakeCanvas();
  const stage = new Stage(canvas, { width: 1000, height: 500, captionStyle: { size: 20 } });
  const a = stage.scene("intro", { title: "はじめに" });
  a.caption("一つ目", 1, 2);
  a.caption("二つ目", 3.5, 1);
  const b = stage.scene("body", { duration: 10, background: "#123" });
  b.caption("三つ目", 0.5, 2);
  return { canvas, stage, a, b };
}

describe("Stage layout", () => {
  beforeEach(() => setTextMeasurer(emMeasurer));
  afterEach(() => setTextMeasurer(null));

  it("lays scenes end to end and lists chapters and global cues", () => {
    const { stage } = twoChapterStage();
    // intro: last caption ends at 4.5, plus the default 1s tail.
    expect(stage.duration).toBe(15.5);
    expect(stage.chapters).toEqual([
      { name: "intro", title: "はじめに", start: 0, duration: 5.5 },
      { name: "body", title: "body", start: 5.5, duration: 10 },
    ]);
    expect(stage.cues.map((c) => [c.text, c.start, c.end])).toEqual([
      ["一つ目", 1, 3],
      ["二つ目", 3.5, 4.5],
      ["三つ目", 6, 8],
    ]);
  });

  it("relayouts after a caption is added", () => {
    const { stage, a } = twoChapterStage();
    expect(stage.duration).toBe(15.5);
    a.caption("四つ目", 6, 1);
    expect(stage.duration).toBe(18);
  });

  it("an empty scene lasts at least one second", () => {
    const stage = new Stage(fakeCanvas());
    stage.scene("blank", { tail: 0 });
    expect(stage.duration).toBe(1);
  });

  it("finds the scene and caption at a time", () => {
    const { stage } = twoChapterStage();
    expect(stage.sceneAt(0)?.name).toBe("intro");
    expect(stage.sceneAt(6)?.name).toBe("body");
    expect(stage.sceneAt(99)?.name).toBe("body");
    expect(stage.cueAt(2)?.text).toBe("一つ目");
    expect(stage.cueAt(3.2)).toBeNull();
    expect(new Stage(fakeCanvas()).sceneAt(0)).toBeUndefined();
  });

  it("say() estimates timings from reading speed for drafts", () => {
    const stage = new Stage(fakeCanvas(), { cps: 5 });
    const s = stage.scene("draft");
    const cues = s.say(["あいうえおかきくけこ", { text: "短い", pause: 1 }, { text: "指定", at: 20, dur: 3 }]);
    expect(cues[0]).toMatchObject({ at: 0.5, dur: 2.6 });
    expect(cues[1]?.at).toBeCloseTo(3.4);
    expect(cues[2]).toMatchObject({ at: 20, dur: 3 });
    const more = s.say(["続き"], { gap: 1, min: 1, cps: 100 });
    expect(more[0]).toMatchObject({ at: 24, dur: 1 });
    expect(s.say(["明示"], { at: 50 })[0]?.at).toBe(50);
  });

  it("sizes the backing store to the pixel size", () => {
    const { canvas, stage } = twoChapterStage();
    expect(canvas.width).toBe(1000);
    stage.setPixelSize(500, 250);
    expect(stage.pixelScale).toBe(0.5);
    expect(canvas.height).toBe(250);
  });

  it("refuses a canvas without a 2D context", () => {
    expect(() => new Stage({ width: 0, height: 0, getContext: () => null })).toThrow(/2D canvas/);
  });
});

describe("Stage.renderAt", () => {
  beforeEach(() => setTextMeasurer(emMeasurer));
  afterEach(() => setTextMeasurer(null));

  it("draws background, the scene with its fade, then the caption band", () => {
    const { canvas, stage } = twoChapterStage();
    stage.scenes[0]?.add(new Rect({ fill: "#abc" }));
    canvas.ctx.reset();
    stage.renderAt(2);
    const fills = callsNamed(canvas.ctx, "fillText").map((c) => c.args[0]);
    expect(fills).toEqual(["一", "つ", "目"]);
    const styles = callsNamed(canvas.ctx, "set:fillStyle").map((c) => c.args[0]);
    expect(styles).toContain("#abc");
    expect(styles).toContain("rgba(0,0,0,0.72)");
  });

  it("fades the scene in and paints its own background", () => {
    const { canvas, stage } = twoChapterStage();
    canvas.ctx.reset();
    stage.renderAt(5.5 + 0.175);
    const alphas = callsNamed(canvas.ctx, "set:globalAlpha").map((c) => c.args[0] as number);
    expect(alphas).toContainEqual(expect.closeTo(0.5, 5));
    expect(callsNamed(canvas.ctx, "set:fillStyle").map((c) => c.args[0])).toContain("#123");
  });

  it("omits captions when disabled and between captions", () => {
    const { canvas, stage } = twoChapterStage();
    stage.captionStyle.enabled = false;
    canvas.ctx.reset();
    stage.renderAt(2);
    expect(callsNamed(canvas.ctx, "fillText")).toHaveLength(0);
    stage.captionStyle.enabled = true;
    canvas.ctx.reset();
    stage.renderAt(3.2);
    expect(callsNamed(canvas.ctx, "fillText")).toHaveLength(0);
  });

  it("balances a multi-line caption so the last line is not a stub", () => {
    const canvas = fakeCanvas();
    const stage = new Stage(canvas, { captionStyle: { size: 10, maxWidth: 100 } });
    stage.scene("s").caption("あ".repeat(11), 0, 5);
    canvas.ctx.reset();
    stage.renderAt(1);
    // 11 em-wide characters at max 100px: unbalanced is 10 + 1, balanced is 6 + 5.
    const ys = new Set(callsNamed(canvas.ctx, "fillText").map((c) => c.args[2]));
    expect(ys.size).toBe(2);
    const rect = callsNamed(canvas.ctx, "arcTo");
    expect(rect.length).toBe(4);
    const firstLine = callsNamed(canvas.ctx, "fillText").filter((c) => c.args[2] === [...ys][0]);
    expect(firstLine).toHaveLength(6);
  });

  it("draws nothing but the background with no scenes", () => {
    const canvas = fakeCanvas();
    const stage = new Stage(canvas);
    canvas.ctx.reset();
    stage.renderAt(0);
    expect(callsNamed(canvas.ctx, "fillRect")).toHaveLength(1);
    expect(callsNamed(canvas.ctx, "save")).toHaveLength(0);
  });
});

describe("Stage time and caption events", () => {
  beforeEach(() => setTextMeasurer(emMeasurer));
  afterEach(() => setTextMeasurer(null));

  it("announces caption changes during playback, not on seeks", () => {
    const { stage } = twoChapterStage();
    const cues: (StageCue | null)[] = [];
    const times: number[] = [];
    const seeks: number[] = [];
    stage.on("cue", (c) => cues.push(c));
    stage.on("time", (t) => times.push(t));
    stage.on("seek", (t) => seeks.push(t));
    stage.seek(2);
    stage.update(2.5);
    stage.update(3.2);
    stage.update(3.6);
    stage.seek(100);
    expect(cues.map((c) => c?.text ?? null)).toEqual([null, "二つ目"]);
    expect(times).toEqual([2, 2.5, 3.2, 3.6, 15.5]);
    expect(seeks).toEqual([2, 15.5]);
  });

  it("off() and the returned unsubscribe stop delivery", () => {
    const { stage } = twoChapterStage();
    const fn = vi.fn();
    const unsubscribe = stage.on("time", fn);
    stage.update(1);
    unsubscribe();
    stage.update(2);
    stage.off("seek", fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exports captions as WebVTT", () => {
    const { stage } = twoChapterStage();
    expect(stage.toVTT()).toContain("00:00:06.000 --> 00:00:08.000\n三つ目");
  });

  it("loadFonts is a no-op without document.fonts", async () => {
    const { stage } = twoChapterStage();
    await expect(stage.loadFonts()).resolves.toBeUndefined();
  });
});
