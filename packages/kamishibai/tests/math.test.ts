import { describe, expect, it } from "vitest";
import { interpolate, parseColor, withAlpha } from "../src/color.ts";
import { clamp, Ease, getEase, lerp } from "../src/ease.ts";
import { pathLength, pathPoint, subPath } from "../src/path.ts";
import { random, stagger } from "../src/util.ts";
import { toVTT, vttTimestamp } from "../src/vtt.ts";

describe("Ease", () => {
  it("every curve starts at 0 and ends at 1", () => {
    for (const [name, fn] of Object.entries(Ease)) {
      expect(fn(0), name).toBeCloseTo(0, 6);
      expect(fn(1), name).toBeCloseTo(1, 6);
    }
  });

  it("covers each branch of the piecewise curves", () => {
    expect(Ease.inOutQuad(0.25)).toBeCloseTo(0.125);
    expect(Ease.inOutQuad(0.75)).toBeCloseTo(0.875);
    expect(Ease.inOutCubic(0.75)).toBeCloseTo(0.9375);
    expect(Ease.inOutQuart(0.25)).toBeCloseTo(0.03125);
    expect(Ease.inOutQuart(0.75)).toBeCloseTo(0.96875);
    expect(Ease.inOutExpo(0.25)).toBeCloseTo(2 ** -5 / 2);
    expect(Ease.inOutExpo(0.75)).toBeCloseTo(1 - 2 ** -5 / 2);
    expect(Ease.outBack(0.5)).toBeGreaterThan(1);
    expect(Ease.outElastic(0.5)).toBeCloseTo(1.0156, 3);
    for (const t of [0.2, 0.5, 0.8, 0.95]) {
      expect(Ease.outBounce(t)).toBeGreaterThanOrEqual(0);
      expect(Ease.outBounce(t)).toBeLessThanOrEqual(1);
    }
  });

  it("getEase resolves names and functions and falls back to outCubic", () => {
    const custom = (t: number) => t / 2;
    expect(getEase(custom)).toBe(custom);
    expect(getEase("linear")).toBe(Ease.linear);
    expect(getEase(undefined)).toBe(Ease.outCubic);
    expect(getEase("nope" as "linear")).toBe(Ease.outCubic);
  });

  it("clamp and lerp", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
});

describe("color", () => {
  it("parses hex in every length and rgb()/rgba()", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255, 1]);
    expect(parseColor("#0008")?.[3]).toBeCloseTo(0x88 / 255);
    expect(parseColor("#102030")).toEqual([16, 32, 48, 1]);
    expect(parseColor("#10203080")?.[3]).toBeCloseTo(0x80 / 255);
    expect(parseColor("rgb(1, 2, 3)")).toEqual([1, 2, 3, 1]);
    expect(parseColor("rgba(1 2 3 / 0.5)")).toEqual([1, 2, 3, 0.5]);
  });

  it("rejects what it cannot read, and caches", () => {
    expect(parseColor(42)).toBeNull();
    expect(parseColor("red")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("rgb(a, b, c)")).toBeNull();
    expect(parseColor("red")).toBeNull();
  });

  it("withAlpha scales alpha and leaves unknown colors alone", () => {
    expect(withAlpha("#ffffff", 0.5)).toBe("rgba(255,255,255,0.5)");
    expect(withAlpha("tomato", 0.5)).toBe("tomato");
  });

  it("interpolates numbers, arrays and colors; steps everything else", () => {
    expect(interpolate(0, 10, 0.5)).toBe(5);
    expect(interpolate([0, 10], [10, 20], 0.5)).toEqual([5, 15]);
    expect(interpolate("#000000", "#ffffff", 0.5)).toBe("rgba(128,128,128,1)");
    expect(interpolate("a", "b", 0.99)).toBe("a");
    expect(interpolate("a", "b", 1)).toBe("b");
    expect(interpolate([0], [1, 2], 0.5)).toEqual([0]);
  });
});

describe("path", () => {
  const L = [0, 0, 100, 0, 100, 100];

  it("measures and walks a polyline", () => {
    expect(pathLength(L)).toBe(200);
    expect(pathPoint(L, 0.25)).toEqual({ x: 50, y: 0, angle: 0 });
    const end = pathPoint(L, 1);
    expect(end.x).toBe(100);
    expect(end.y).toBe(100);
    expect(end.angle).toBeCloseTo(Math.PI / 2);
  });

  it("handles degenerate inputs", () => {
    expect(pathPoint([], 0.5)).toEqual({ x: 0, y: 0, angle: 0 });
    expect(pathPoint([3, 4], 0.5)).toEqual({ x: 3, y: 4, angle: 0 });
    expect(pathPoint([1, 1, 1, 1], 0.5)).toEqual({ x: 1, y: 1, angle: 0 });
  });

  it("cuts a sub-path across segments", () => {
    expect(subPath(L, 0.25, 0.75)).toEqual([
      [50, 0],
      [100, 0],
      [100, 50],
    ]);
    expect(subPath(L, 0, 0)).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(subPath([5, 5], 0, 1)).toEqual([]);
  });
});

describe("util", () => {
  it("random is deterministic per seed and in [0, 1)", () => {
    const a = random(7);
    const b = random(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(random(0)()).toBe(random(1)());
  });

  it("stagger offsets start times", () => {
    const seen: [string, number, number][] = [];
    stagger(["a", "b", "c"], 1, 0.5, (n, at, i) => seen.push([n, at, i]));
    expect(seen).toEqual([
      ["a", 1, 0],
      ["b", 1.5, 1],
      ["c", 2, 2],
    ]);
  });
});

describe("vtt", () => {
  it("formats timestamps", () => {
    expect(vttTimestamp(0)).toBe("00:00:00.000");
    expect(vttTimestamp(3725.5)).toBe("01:02:05.500");
    expect(vttTimestamp(-1)).toBe("00:00:00.000");
  });

  it("writes cues with emphasis stripped", () => {
    expect(toVTT([{ text: "**AI-DLC** とは", start: 1, end: 2.5 }])).toBe(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nAI-DLC とは\n",
    );
  });
});
