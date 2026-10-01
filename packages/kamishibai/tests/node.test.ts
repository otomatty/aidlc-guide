import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Node } from "../src/node.ts";
import {
  Circle,
  Counter,
  Group,
  ImageNode,
  Line,
  Rect,
  Shape,
  Text,
} from "../src/shapes.ts";
import { setTextMeasurer } from "../src/text-layout.ts";
import { callsNamed, emMeasurer, fakeContext } from "./fake-canvas.ts";

describe("Node tweens", () => {
  it("is a pure function of time: to() interpolates and holds", () => {
    const n = new Rect({ x: 0 }).to({ x: 100 }, { at: 1, dur: 2, ease: "linear" });
    expect(n.get("x", 0)).toBe(0);
    expect(n.get("x", 2)).toBe(50);
    expect(n.get("x", 99)).toBe(100);
    // Any order gives the same answers.
    expect(n.get("x", 2)).toBe(50);
  });

  it("chains tweens from where the previous one left off", () => {
    const n = new Rect({ x: 0 })
      .to({ x: 100 }, { at: 0, dur: 1, ease: "linear" })
      .to({ x: 0 }, { at: 2, dur: 1, ease: "linear" });
    expect(n.get("x", 1.5)).toBe(100);
    expect(n.get("x", 2.5)).toBe(50);
  });

  it("re-derives start values when an earlier tween is added later", () => {
    const n = new Rect({ x: 0 }).to({ x: 100 }, { at: 2, dur: 1, ease: "linear" });
    expect(n.get("x", 2.5)).toBe(50);
    n.to({ x: 50 }, { at: 0, dur: 1, ease: "linear" });
    expect(n.get("x", 2.5)).toBe(75);
  });

  it("orders same-time tweens by insertion", () => {
    const n = new Rect({ x: 0 }).set({ x: 1 }, 1).set({ x: 2 }, 1);
    expect(n.get("x", 1)).toBe(2);
  });

  it("from() animates in from the given values", () => {
    const n = new Rect({ opacity: 1 }).from({ opacity: 0 }, { at: 0, dur: 1, ease: "linear" });
    expect(n.get("opacity", 0)).toBe(0);
    expect(n.get("opacity", 1)).toBe(1);
  });

  it("fadeIn / fadeOut / life / pop", () => {
    const n = new Rect({ x: 10, y: 20 }).fadeIn(1, 1, { dx: 5, dy: 5, scale: 0.5, ease: "linear" });
    expect(n.resolve(1)).toMatchObject({ opacity: 0, x: 15, y: 25, scale: 0.5 });
    expect(n.resolve(2)).toMatchObject({ opacity: 1, x: 10, y: 20, scale: 1 });
    n.fadeOut(3, 1, { dy: 10, scale: 2, ease: "linear" });
    expect(n.resolve(4)).toMatchObject({ opacity: 0, y: 30, scale: 2 });

    const l = new Rect().life(0, 2, { inDur: 1, outDur: 1 });
    expect(l.get("opacity", 1.5)).toBe(1);
    expect(l.get("opacity", 3)).toBe(0);
    expect(new Rect().life(0, null).lastTime()).toBe(0.6);
    expect(new Rect().life(0).get("opacity", 10)).toBe(1);

    const p = new Rect().pop(1, 0.5);
    expect(p.get("scale", 1)).toBeCloseTo(0);
    expect(p.get("scale", 2)).toBe(1);
  });

  it("lastTime spans the subtree", () => {
    const child = new Rect().to({ x: 1 }, { at: 5, dur: 2 });
    const g = new Group({}, [child]).to({ y: 1 }, { at: 1 });
    expect(g.lastTime()).toBe(7);
    expect(child.parent).toBe(g);
  });

  it("tweenTargets lists the values a property is animated to", () => {
    const t = new Text({ text: "a" }).set({ text: "b" }, 1).set({ text: "c" }, 2);
    expect(t.tweenTargets("text")).toEqual(["b", "c"]);
    expect(t.tweenTargets("x")).toEqual([]);
  });

  it("walk visits the whole tree", () => {
    const leaf = new Rect();
    const root = new Group({}, [new Group({}, [leaf])]);
    const seen: Node[] = [];
    root.walk((n) => seen.push(n));
    expect(seen).toHaveLength(3);
    expect(seen[2]).toBe(leaf);
  });
});

describe("Node.render", () => {
  it("skips invisible and transparent nodes", () => {
    const ctx = fakeContext();
    new Rect({ visible: false }).render(ctx, 0);
    new Rect({ opacity: 0 }).render(ctx, 0);
    expect(ctx.calls).toEqual([]);
  });

  it("applies transform, alpha, blend and shadow, then children", () => {
    const ctx = fakeContext();
    const child = new Rect({ fill: "#f00" });
    new Group(
      {
        x: 10,
        y: 20,
        rotation: 90,
        scale: 2,
        opacity: 0.5,
        blend: "multiply",
        shadowBlur: 4,
        shadowY: 2,
        shadowColor: "#000",
      },
      [child],
    ).render(ctx, 0);
    const names = ctx.calls.map((c) => c.name);
    expect(names[0]).toBe("save");
    expect(callsNamed(ctx, "translate")[0]?.args).toEqual([10, 20]);
    expect(callsNamed(ctx, "rotate")[0]?.args[0]).toBeCloseTo(Math.PI / 2);
    expect(callsNamed(ctx, "scale")[0]?.args).toEqual([2, 2]);
    expect(names).toContain("set:globalCompositeOperation");
    expect(names).toContain("set:shadowBlur");
    expect(callsNamed(ctx, "fill")).toHaveLength(1);
    expect(names.at(-1)).toBe("restore");
  });

  it("rides a path when one is set", () => {
    const ctx = fakeContext();
    new Rect({ path: [0, 0, 100, 0], along: 0.5, x: 1, y: 2 }).render(ctx, 0);
    expect(callsNamed(ctx, "translate")[0]?.args).toEqual([51, 2]);
  });
});

describe("shapes", () => {
  beforeEach(() => setTextMeasurer(emMeasurer));
  afterEach(() => setTextMeasurer(null));

  it("Rect fills and strokes with a dash", () => {
    const ctx = fakeContext();
    new Rect({ w: 10, h: 10, radius: 3, stroke: "#fff", lineWidth: 2, dash: [4, 2], dashOffset: 1 }).render(ctx, 0);
    expect(callsNamed(ctx, "arcTo")).toHaveLength(4);
    expect(callsNamed(ctx, "stroke")).toHaveLength(1);
    expect(callsNamed(ctx, "setLineDash")[0]?.args).toEqual([[4, 2]]);
  });

  it("Rect with no fill and no stroke draws a path only", () => {
    const ctx = fakeContext();
    new Rect({ fill: null }).render(ctx, 0);
    expect(callsNamed(ctx, "fill")).toHaveLength(0);
    expect(callsNamed(ctx, "stroke")).toHaveLength(0);
  });

  it("Circle draws a full disc or a pie sweep", () => {
    const full = fakeContext();
    new Circle({ r: 5 }).render(full, 0);
    expect(callsNamed(full, "arc")[0]?.args.slice(3)).toEqual([0, Math.PI * 2]);
    const pie = fakeContext();
    new Circle({ r: 5, sweep: 0.25 }).render(pie, 0);
    expect(callsNamed(pie, "moveTo")).toHaveLength(1);
    expect(callsNamed(pie, "closePath")).toHaveLength(1);
    const ring = fakeContext();
    new Circle({ r: -1, sweep: 0.5, fill: null, stroke: "#fff", lineWidth: 1 }).render(ring, 0);
    expect(callsNamed(ring, "arc")[0]?.args[2]).toBe(0);
    expect(callsNamed(ring, "moveTo")).toHaveLength(0);
  });

  it("Line draws its trimmed stretch with an arrowhead and dash", () => {
    const ctx = fakeContext();
    new Line({ points: [0, 0, 100, 0], trimEnd: 0.5, arrow: 10, dash: [2, 2] }).render(ctx, 0);
    expect(callsNamed(ctx, "lineTo")[0]?.args).toEqual([50, 0]);
    expect(callsNamed(ctx, "fill")).toHaveLength(1);
    expect(callsNamed(ctx, "setLineDash")[0]?.args).toEqual([[2, 2]]);
  });

  it("Line draws nothing when trimmed away or degenerate", () => {
    const ctx = fakeContext();
    new Line({ trimStart: 0.5, trimEnd: 0.5 }).render(ctx, 0);
    new Line({ points: [0, 0] }).render(ctx, 0);
    expect(callsNamed(ctx, "stroke")).toHaveLength(0);
  });

  it("Text draws laid-out tokens, colouring emphasis", () => {
    const ctx = fakeContext();
    new Text({ text: "a**b**", size: 10, color: "#111", emColor: "#f00", align: "center" }).render(ctx, 0);
    const fills = callsNamed(ctx, "fillText");
    expect(fills.map((c) => c.args[0])).toEqual(["a", "b"]);
    expect(fills[0]?.args[1]).toBe(-10);
    const styles = callsNamed(ctx, "set:fillStyle").map((c) => c.args[0]);
    expect(styles).toEqual(["#111", "#f00"]);
  });

  it("Text right-aligns and reveals a fraction of its characters", () => {
    const ctx = fakeContext();
    new Text({ text: "あいうえ", size: 10, align: "right", reveal: 0.5 }).render(ctx, 0);
    const fills = callsNamed(ctx, "fillText");
    expect(fills.map((c) => c.args[0])).toEqual(["あ", "い"]);
    expect(fills[0]?.args[1]).toBe(-40);
  });

  it("Text cuts a token mid-way when revealing", () => {
    const ctx = fakeContext();
    new Text({ text: "abcd", size: 10, reveal: 0.5 }).render(ctx, 0);
    expect(callsNamed(ctx, "fillText").map((c) => c.args[0])).toEqual(["ab"]);
  });

  it("Text.fit shrinks to the line limit, but not below minSize", () => {
    const long = "あ".repeat(20);
    const fitted = new Text({ text: long, size: 40, maxWidth: 400, fit: { maxLines: 1, minSize: 10 } });
    expect(fitted.measure()).toMatchObject({ lines: 1, size: 20 });
    const floor = new Text({ text: long, size: 40, maxWidth: 100, fit: { maxLines: 1, minSize: 16 } });
    expect(floor.measure()).toMatchObject({ size: 16 });
    expect(floor.measure().lines).toBeGreaterThan(1);
    expect(new Text({ text: long, size: 40, maxWidth: 400 }).measure().size).toBe(40);
  });

  it("Text.allText and fonts include tweened text and the fitted size", () => {
    const t = new Text({ text: "**a**", size: 30, weight: 400, emWeight: 700, family: "X" }).set({ text: "b" }, 1);
    expect(t.allText()).toBe("ab");
    expect(t.fonts(t.props)).toEqual(["400 30px X", "700 30px X"]);
  });

  it("Counter prints its tweened value through format", () => {
    const ctx = fakeContext();
    const c = new Counter({ value: 0, size: 10 }).to({ value: 90 }, { at: 0, dur: 1, ease: "linear" });
    c.render(ctx, 0.5);
    expect(callsNamed(ctx, "fillText")[0]?.args[0]).toBe("45");
    const pct = new Counter({ value: 12.5, format: (v) => `${v}%` });
    expect(pct.allText()).toBe("12.5%");
  });

  it("Shape calls its draw function with props and time", () => {
    const ctx = fakeContext();
    const seen: number[] = [];
    new Shape({ x: 3, draw: (_c, p, t) => seen.push(p.x, t) }).render(ctx, 2);
    expect(seen).toEqual([3, 2]);
    new Shape().render(ctx, 0);
  });

  it("ImageNode draws a decoded source and skips a URL that cannot load here", () => {
    const ctx = fakeContext();
    const bitmap = {} as CanvasImageSource;
    new ImageNode({ src: bitmap, w: 10, h: 20 }).render(ctx, 0);
    expect(callsNamed(ctx, "drawImage")[0]?.args).toEqual([bitmap, -5, -10, 10, 20]);
    const remote = new ImageNode({ src: "data:image/png;base64," });
    remote.render(ctx, 0);
    new ImageNode({ src: null }).render(ctx, 0);
    expect(callsNamed(ctx, "drawImage")).toHaveLength(1);
    return remote.ready;
  });
});
