import type { Storyboard } from "@aidlc-guide/kamishibai/storyboard";
import { describe, expect, it } from "vitest";
import { captionsVtt, globalCues } from "../src/captions.ts";
import { NARRATION_ENCODING, placeholderNarrationArgs } from "../src/narration.ts";
import { plainTextForSpeech } from "../src/speech.ts";
import { buildTimeline, DEFAULT_TIMING, estimateSpeechSeconds } from "../src/timeline.ts";

const STORYBOARD: Storyboard = {
  formatVersion: 1,
  page: "guide/x.md",
  sourceHash: "e".repeat(64),
  title: "T",
  chapters: [
    { id: "a", title: "A", template: "title", cues: [{ text: "一" }, { text: "**二**" }], data: {} },
    { id: "b", title: "B", template: "points", cues: [{ text: "三" }], data: {} },
  ],
};

describe("buildTimeline", () => {
  it("times every caption from its narration length", () => {
    const timeline = buildTimeline(STORYBOARD, [[2, 0.5], [3]]);
    // a: lead 1 → cue0 1..3.15, gap .35 → cue1 3.5..5 (min 1.5), tail 1 → 6.
    // b: starts at 6, cue0 1..4.15, tail → 5.15.
    expect(timeline).toEqual({
      formatVersion: 1,
      duration: 11.15,
      chapters: [
        { id: "a", start: 0, duration: 6, cues: [{ start: 1, end: 3.15 }, { start: 3.5, end: 5 }] },
        { id: "b", start: 6, duration: 5.15, cues: [{ start: 1, end: 4.15 }] },
      ],
    });
  });

  it("honours custom timing", () => {
    const timeline = buildTimeline(STORYBOARD, [[1, 1], [1]], { ...DEFAULT_TIMING, lead: 0, tail: 0, gap: 0, hold: 0, minCaption: 0 });
    expect(timeline.duration).toBe(3);
  });

  it("insists on one length per chapter and per caption", () => {
    expect(() => buildTimeline(STORYBOARD, [[1, 1]])).toThrow(/per chapter/);
    expect(() => buildTimeline(STORYBOARD, [[1], [1]])).toThrow(/chapter a/);
    expect(() => buildTimeline(STORYBOARD, [[1, Number.NaN], [1]])).toThrow(/caption 1/);
  });

  it("estimates speech from the spoken text", () => {
    expect(estimateSpeechSeconds("**一二三四五六七**")).toBe(1);
    expect(estimateSpeechSeconds("abcd", 2)).toBe(2);
    expect(plainTextForSpeech("  **強調**  と\n改行 ")).toBe("強調 と 改行");
  });
});

describe("captions", () => {
  it("places chapter captions on the global clock", () => {
    const timeline = buildTimeline(STORYBOARD, [[2, 0.5], [3]]);
    expect(globalCues(STORYBOARD, timeline).map((c) => [c.text, c.start, c.end])).toEqual([
      ["一", 1, 3.15],
      ["**二**", 3.5, 5],
      ["三", 7, 10.15],
    ]);
    expect(captionsVtt(STORYBOARD, timeline)).toContain("00:00:07.000 --> 00:00:10.150\n三");
  });

  it("refuses a timeline from another storyboard", () => {
    const timeline = buildTimeline(STORYBOARD, [[2, 0.5], [3]]);
    const other = { ...timeline, chapters: [timeline.chapters[1], timeline.chapters[0]] } as typeof timeline;
    expect(() => globalCues(STORYBOARD, other)).toThrow(/chapter a/);
  });
});

describe("placeholderNarrationArgs", () => {
  it("mixes one beep per caption start into silence and encodes Opus", () => {
    const args = placeholderNarrationArgs([1, 3.5], 6, "out.opus");
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toBe(
      "[0]atrim=0:6[s];[1]volume=0.3,asplit=2[b0][b1];[b0]adelay=1000:all=1[d0];[b1]adelay=3500:all=1[d1];[s][d0][d1]amix=inputs=3:normalize=0:duration=first[out]",
    );
    expect(args.slice(-NARRATION_ENCODING.length - 1, -1)).toEqual([...NARRATION_ENCODING]);
    expect(args.at(-1)).toBe("out.opus");
  });

  it("needs at least one caption", () => {
    expect(() => placeholderNarrationArgs([], 1, "x.opus")).toThrow();
  });
});
