import { DOC_VIDEO_TEMPLATES } from "@aidlc-guide/shared-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stage } from "../src/stage.ts";
import { setTextMeasurer } from "../src/text-layout.ts";
import { loadVideo } from "../src/video/load.ts";
import { parseStoryboard, parseTimeline, type Storyboard, type Timeline } from "../src/video/storyboard.ts";
import { DEFAULT_THEME, TEMPLATE_NAMES, templateFor } from "../src/video/templates.ts";
import { callsNamed, emMeasurer, fakeCanvas } from "./fake-canvas.ts";

const HASH = "c".repeat(64);

function storyboard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1,
    page: "guide/04-phases-and-stages.md",
    sourceHash: HASH,
    title: "フェーズとステージ",
    chapters: [
      {
        id: "intro",
        title: "はじめに",
        template: "title",
        cues: [{ text: "AI-DLC の**流れ**を見ます。" }],
        data: { eyebrow: "ガイド", headline: "フェーズとステージ", subtitle: "全体像" },
      },
      {
        id: "phases",
        title: "4つのフェーズ",
        template: "flow",
        cues: [{ text: "一つ目" }, { text: "二つ目" }],
        data: {
          heading: "流れ",
          steps: [{ label: "構想" }, { label: "計画", sub: "要件" }, { label: "構築", at: 1 }, { label: "運用" }],
        },
      },
      {
        id: "points",
        title: "要点",
        template: "points",
        cues: [{ text: "まとめ" }],
        data: { heading: "覚えること", items: [{ text: "承認で進む" }, { text: "記録が残る", at: 0 }] },
      },
    ],
    ...overrides,
  };
}

function timeline(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1,
    duration: 20,
    chapters: [
      { id: "intro", start: 0, duration: 5, cues: [{ start: 1, end: 4 }] },
      { id: "phases", start: 5, duration: 10, cues: [{ start: 1, end: 4 }, { start: 4.5, end: 9 }] },
      { id: "points", start: 15, duration: 5, cues: [{ start: 1, end: 4 }] },
    ],
    ...overrides,
  };
}

function parsed(sb = storyboard(), tl = timeline()): { sb: Storyboard; tl: Timeline } {
  const s = parseStoryboard(sb);
  const t = parseTimeline(tl);
  if (!s.ok) throw new Error(s.error);
  if (!t.ok) throw new Error(t.error);
  return { sb: s.value, tl: t.value };
}

describe("parseStoryboard", () => {
  it("accepts a valid storyboard, defaulting data to {}", () => {
    const raw = storyboard();
    const chapters = raw.chapters as Record<string, unknown>[];
    delete chapters[2]?.data;
    const result = parseStoryboard(raw);
    expect(result.ok && result.value.chapters[2]?.data).toEqual({});
    expect(result.ok && result.value.sourceHash).toBe(HASH);
  });

  const chapter = (o: Record<string, unknown>) => ({
    chapters: [{ id: "a", title: "A", template: "title", cues: [{ text: "x" }], data: {}, ...o }],
  });

  it.each([
    ["not an object", null],
    ["format", storyboard({ formatVersion: 2 })],
    ["page", storyboard({ page: "" })],
    ["hash", storyboard({ sourceHash: "abc" })],
    ["title", storyboard({ title: 1 })],
    ["no chapters", storyboard({ chapters: [] })],
    ["chapter not object", storyboard({ chapters: ["x"] })],
    ["chapter header", storyboard(chapter({ template: "" }))],
    ["no cues", storyboard(chapter({ cues: [] }))],
    ["cue text", storyboard(chapter({ cues: [{ text: " " }] }))],
    ["data shape", storyboard(chapter({ data: [] }))],
    [
      "duplicate chapter",
      storyboard({
        chapters: [
          { id: "a", title: "A", template: "title", cues: [{ text: "x" }] },
          { id: "a", title: "B", template: "title", cues: [{ text: "y" }] },
        ],
      }),
    ],
  ])("rejects %s", (_label, raw) => {
    expect(parseStoryboard(raw).ok).toBe(false);
  });
});

describe("parseTimeline", () => {
  it("accepts a valid timeline", () => {
    expect(parseTimeline(timeline())).toMatchObject({ ok: true, value: { duration: 20 } });
  });

  const one = (o: Record<string, unknown>, duration = 5) =>
    timeline({ duration, chapters: [{ id: "a", start: 0, duration: 5, cues: [{ start: 1, end: 2 }], ...o }] });

  it.each([
    ["not an object", "x"],
    ["format", timeline({ formatVersion: 0 })],
    ["duration", timeline({ duration: 0 })],
    ["no chapters", timeline({ chapters: [] })],
    ["chapter not object", timeline({ chapters: [1] })],
    ["chapter header", one({ duration: -1 })],
    ["gap between chapters", one({ start: 1 })],
    ["cues type", one({ cues: {} })],
    ["inverted cue", one({ cues: [{ start: 2, end: 1 }] })],
    ["cue past end", one({ cues: [{ start: 1, end: 9 }] })],
    ["duration mismatch", one({}, 7)],
  ])("rejects %s", (_label, raw) => {
    expect(parseTimeline(raw).ok).toBe(false);
  });
});

describe("templates", () => {
  it("implements exactly the contract's template list", () => {
    expect([...TEMPLATE_NAMES]).toEqual([...DOC_VIDEO_TEMPLATES]);
    for (const name of DOC_VIDEO_TEMPLATES) expect(templateFor(name)).not.toBeNull();
    expect(templateFor("hologram")).toBeNull();
    expect(templateFor("constructor")).toBeNull();
  });
});

describe("loadVideo", () => {
  beforeEach(() => setTextMeasurer(emMeasurer));
  afterEach(() => setTextMeasurer(null));

  it("builds one scene per chapter with captions at the timeline's times", () => {
    const { sb, tl } = parsed();
    const canvas = fakeCanvas();
    const stage = new Stage(canvas);
    expect(loadVideo(stage, sb, tl)).toEqual({ ok: true, value: undefined });
    expect(stage.duration).toBe(20);
    expect(stage.background).toBe(DEFAULT_THEME.background);
    expect(stage.chapters.map((c) => [c.name, c.title, c.start])).toEqual([
      ["intro", "はじめに", 0],
      ["phases", "4つのフェーズ", 5],
      ["points", "要点", 15],
    ]);
    expect(stage.cues.map((c) => [c.start, c.end])).toEqual([
      [1, 4],
      [6, 9],
      [9.5, 14],
      [16, 19],
    ]);
    // Every chapter draws, at every point of its life.
    for (const t of [0.5, 2, 6, 8, 12, 16, 19.9]) stage.renderAt(t);
    expect(callsNamed(canvas.ctx, "fillText").length).toBeGreaterThan(0);
  });

  it("works without the optional template fields", () => {
    const { sb, tl } = parsed(
      storyboard({
        chapters: [
          { id: "intro", title: "T", template: "title", cues: [{ text: "x" }], data: { headline: "H" } },
          { id: "phases", title: "F", template: "flow", cues: [{ text: "a" }, { text: "b" }], data: { steps: Array.from({ length: 6 }, (_, i) => ({ label: `S${i}` })) } },
          { id: "points", title: "P", template: "points", cues: [{ text: "c" }], data: { items: [{ text: "i" }] } },
        ],
      }),
    );
    const stage = new Stage(fakeCanvas());
    expect(loadVideo(stage, sb, tl).ok).toBe(true);
    for (const t of [1, 8, 18]) stage.renderAt(t);
  });

  it("refuses a stage that already has scenes", () => {
    const { sb, tl } = parsed();
    const stage = new Stage(fakeCanvas());
    stage.scene("existing");
    expect(loadVideo(stage, sb, tl)).toMatchObject({ ok: false, error: "stage already has scenes" });
  });

  it("refuses storyboard/timeline disagreements and unknown templates", () => {
    const { sb, tl } = parsed();
    const fresh = () => new Stage(fakeCanvas());
    expect(loadVideo(fresh(), sb, { ...tl, chapters: tl.chapters.slice(1) }).ok).toBe(false);
    const swapped = { ...tl, chapters: [tl.chapters[1], tl.chapters[0], tl.chapters[2]] } as Timeline;
    expect(loadVideo(fresh(), sb, swapped)).toMatchObject({ error: "timeline has no chapter intro here" });
    const fewerCues = { ...sb, chapters: sb.chapters.map((c, i) => (i === 1 ? { ...c, cues: c.cues.slice(1) } : c)) };
    expect(loadVideo(fresh(), fewerCues, tl)).toMatchObject({ error: expect.stringContaining("caption count") });
    const unknown = { ...sb, chapters: sb.chapters.map((c, i) => (i === 0 ? { ...c, template: "hologram" } : c)) };
    expect(loadVideo(fresh(), unknown, tl)).toMatchObject({ error: expect.stringContaining("unknown template") });
  });

  it.each([
    ["title without headline", 0, {}],
    ["blank eyebrow", 0, { headline: "H", eyebrow: " " }],
    ["flow with one step", 1, { steps: [{ label: "x" }] }],
    ["flow step not object", 1, { steps: ["x", "y"] }],
    ["flow bad at", 1, { steps: [{ label: "x", at: -1 }, { label: "y" }] }],
    ["points with too many items", 2, { items: Array.from({ length: 6 }, () => ({ text: "x" })) }],
    ["points item without text", 2, { items: [{}] }],
  ])("reports bad template data (%s) and leaves the stage empty", (_label, index, data) => {
    const { sb, tl } = parsed();
    const broken = { ...sb, chapters: sb.chapters.map((c, i) => (i === index ? { ...c, data } : c)) };
    const stage = new Stage(fakeCanvas());
    const result = loadVideo(stage, broken, tl);
    expect(result.ok).toBe(false);
    expect(stage.scenes).toHaveLength(0);
    expect(stage.duration).toBe(0);
  });

  it("rethrows errors that are not about template data", () => {
    const { sb, tl } = parsed();
    const stage = new Stage(fakeCanvas());
    const original = stage.scene.bind(stage);
    let calls = 0;
    stage.scene = (...args) => {
      calls++;
      if (calls === 2) throw new RangeError("boom");
      return original(...args);
    };
    expect(() => loadVideo(stage, sb, tl)).toThrow(RangeError);
  });
});
