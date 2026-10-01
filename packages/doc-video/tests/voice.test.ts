import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  durationArgs,
  mixNarrationArgs,
  NARRATION_ENCODING,
  toneArgs,
  trimSilenceArgs,
  type AudioOps,
} from "../src/audio.ts";
import type { TtsProvider } from "../src/tts.ts";
import {
  clipKey,
  loadVoiceConfig,
  parseVoiceConfig,
  pendingCharacters,
  readStoryboard,
  speechFor,
  type VoiceConfig,
  voicePage,
} from "../src/voice.ts";

const CONFIG: VoiceConfig = {
  provider: "grok",
  voice: "eve",
  language: "ja",
  readings: { "AI-DLC": "エーアイディーエルシー", AI: "エーアイ" },
  budgetUsd: 2,
};

const STORYBOARD = {
  formatVersion: 1,
  page: "guide/x.md",
  sourceHash: "f".repeat(64),
  title: "T",
  chapters: [
    { id: "a", title: "A", template: "title", cues: [{ text: "**AI-DLC** と AI" }, { text: "二", speech: "に" }], data: { headline: "H" } },
    { id: "b", title: "B", template: "title", cues: [{ text: "三" }], data: { headline: "H" } },
  ],
};

let tmp: string;
let pageDir: string;
let cacheDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), "voice-"));
  pageDir = path.join(tmp, "videos", "ja", "guide", "x");
  cacheDir = path.join(tmp, "cache");
  await mkdir(pageDir, { recursive: true });
  await writeFile(path.join(pageDir, "storyboard.json"), JSON.stringify(STORYBOARD));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Fake ffmpeg: a clip's "length" is its byte count; files are written so the cache works. */
function fakeAudio(): AudioOps & { mixes: unknown[] } {
  const mixes: unknown[] = [];
  return {
    mixes,
    trim: vi.fn(async (raw: Uint8Array, output: string) => {
      await writeFile(output, raw);
    }),
    duration: vi.fn(async (file: string) => (await readFile(file)).byteLength),
    mix: vi.fn(async (clips, duration, output) => {
      mixes.push({ clips, duration });
      await writeFile(output, "OggS");
    }),
  };
}

function fakeTts(): TtsProvider & { synthesize: ReturnType<typeof vi.fn> } {
  return {
    id: "fake",
    synthesize: vi.fn(async ({ text }: { text: string }) => new Uint8Array([...text].map(() => 0))),
  };
}

describe("speechFor", () => {
  it("prefers explicit speech, else applies readings longest first", () => {
    expect(speechFor({ text: "**AI-DLC** と AI" }, CONFIG.readings)).toBe("エーアイディーエルシー と エーアイ");
    expect(speechFor({ text: "x", speech: " **よみ** " }, CONFIG.readings)).toBe("よみ");
  });
});

describe("clipKey", () => {
  it("changes with anything that changes the audio, and only then", () => {
    const base = clipKey("grok", CONFIG, "テキスト");
    expect(clipKey("grok", CONFIG, "テキスト")).toBe(base);
    expect(base).toMatch(/^[0-9a-f]{16}$/);
    expect(clipKey("grok", { ...CONFIG, voice: "ara" }, "テキスト")).not.toBe(base);
    expect(clipKey("grok", { ...CONFIG, language: "en" }, "テキスト")).not.toBe(base);
    expect(clipKey("tone", CONFIG, "テキスト")).not.toBe(base);
    expect(clipKey("grok", CONFIG, "別")).not.toBe(base);
  });
});

describe("voice config", () => {
  it("parses with defaults and rejects bad values", () => {
    expect(parseVoiceConfig({ voice: "eve", language: "ja" })).toEqual({
      provider: "grok",
      voice: "eve",
      language: "ja",
      readings: {},
      budgetUsd: 2,
    });
    expect(() => parseVoiceConfig({ provider: "other", voice: "eve", language: "ja" })).toThrow(/provider/);
    expect(() => parseVoiceConfig({ language: "ja" })).toThrow(/voice/);
    expect(() => parseVoiceConfig({ voice: "eve" })).toThrow(/language/);
    expect(() => parseVoiceConfig({ voice: "eve", language: "ja", readings: { a: 1 } })).toThrow(/readings/);
    expect(() => parseVoiceConfig({ voice: "eve", language: "ja", readings: [] })).toThrow(/readings/);
    expect(() => parseVoiceConfig({ voice: "eve", language: "ja", budgetUsd: 0 })).toThrow(/budgetUsd/);
    expect(() => parseVoiceConfig(null)).toThrow(/voice/);
  });

  it("is found in the nearest parent directory", async () => {
    await writeFile(path.join(tmp, "videos", "ja", "voice.json"), JSON.stringify({ voice: "ara", language: "ja" }));
    expect((await loadVoiceConfig(pageDir)).voice).toBe("ara");
  });

  it("is required", async () => {
    await expect(loadVoiceConfig(pageDir)).rejects.toThrow(/no voice\.json/);
  });
});

describe("voicePage", () => {
  it("synthesizes each caption once, times the video from the clips and mixes the narration", async () => {
    const tts = fakeTts();
    const audio = fakeAudio();
    const result = await voicePage(pageDir, { provider: tts, config: CONFIG, audio, cacheDir, concurrency: 2 });
    expect(tts.synthesize).toHaveBeenCalledTimes(3);
    expect(tts.synthesize.mock.calls.map((c) => c[0].text)).toEqual(["エーアイディーエルシー と エーアイ", "に", "三"]);
    expect(result).toMatchObject({ synthesized: 3, cached: 0 });
    // Clip lengths are the character counts: 18, 1 and 1 "seconds".
    const timeline = JSON.parse(await readFile(path.join(pageDir, "timeline.json"), "utf8"));
    expect(timeline.chapters[0].cues).toEqual([
      { start: 1, end: 19.15 },
      { start: 19.5, end: 21 },
    ]);
    expect(await readFile(path.join(pageDir, "captions.vtt"), "utf8")).toContain("AI-DLC と AI");
    expect(existsSync(path.join(pageDir, "narration.opus"))).toBe(true);
    expect(audio.mixes).toEqual([
      {
        clips: [
          { file: expect.stringMatching(/\.wav$/), start: 1 },
          { file: expect.stringMatching(/\.wav$/), start: 19.5 },
          { file: expect.stringMatching(/\.wav$/), start: 23 },
        ],
        duration: timeline.duration,
      },
    ]);
  });

  it("re-synthesizes only what changed", async () => {
    const audio = fakeAudio();
    await voicePage(pageDir, { provider: fakeTts(), config: CONFIG, audio, cacheDir });
    const storyboard = await readStoryboard(pageDir);
    expect(pendingCharacters(storyboard, "fake", CONFIG, cacheDir)).toBe(0);
    const edited = structuredClone(STORYBOARD);
    edited.chapters[1]!.cues[0]!.text = "三つ目";
    await writeFile(path.join(pageDir, "storyboard.json"), JSON.stringify(edited));
    expect(pendingCharacters(await readStoryboard(pageDir), "fake", CONFIG, cacheDir)).toBe(3);
    const tts = fakeTts();
    const result = await voicePage(pageDir, { provider: tts, config: CONFIG, audio, cacheDir });
    expect(tts.synthesize).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ synthesized: 1, cached: 2 });
  });

  it("rejects an invalid storyboard", async () => {
    await writeFile(path.join(pageDir, "storyboard.json"), "{}");
    await expect(voicePage(pageDir, { provider: fakeTts(), config: CONFIG, audio: fakeAudio(), cacheDir })).rejects.toThrow(
      /storyboard/,
    );
  });
});

describe("ffmpeg arguments", () => {
  it("trims silence from both ends into mono 24 kHz", () => {
    const args = trimSilenceArgs("in", "out.wav");
    expect(args).toContain("-af");
    expect(args[args.indexOf("-af") + 1]).toMatch(/^silenceremove=.*-45dB.*,areverse,silenceremove=.*,areverse$/);
    expect(args.slice(-5)).toEqual(["-ar", "24000", "-ac", "1", "out.wav"]);
  });

  it("measures with ffprobe", () => {
    expect(durationArgs("a.wav").at(-1)).toBe("a.wav");
  });

  it("places clips, normalises loudness and encodes 12 kbps Opus", () => {
    const args = mixNarrationArgs([{ file: "a.wav", start: 1 }, { file: "b.wav", start: 3.5 }], 6, "n.opus");
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toBe(
      "[0]adelay=1000:all=1[d0];[1]adelay=3500:all=1[d1];[d0][d1]amix=inputs=2:normalize=0,apad,atrim=0:6,loudnorm=I=-16:TP=-1.5:LRA=11[out]",
    );
    expect(args.slice(-NARRATION_ENCODING.length - 1, -1)).toEqual([...NARRATION_ENCODING]);
    expect(() => mixNarrationArgs([], 1, "n.opus")).toThrow();
  });

  it("renders a stand-in tone to stdout", () => {
    expect(toneArgs(1.23456)).toContain("sine=f=440:r=24000:d=1.235");
    expect(toneArgs(1).at(-1)).toBe("pipe:1");
  });
});
