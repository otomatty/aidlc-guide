/**
 * Narrate a page: one TTS call per caption (cached by content), trim and
 * measure each clip, derive the timeline from those lengths, and mix the
 * pack's narration file. Changing one caption re-synthesizes that caption only.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseStoryboard,
  type StoryCue,
  type Storyboard,
  type Timeline,
} from "@aidlc-guide/kamishibai/storyboard";
import { VIDEO_FILES } from "@aidlc-guide/official-docs";
import type { AudioOps } from "./audio.ts";
import { captionsVtt, globalCues } from "./captions.ts";
import { plainTextForSpeech } from "./speech.ts";
import { buildTimeline } from "./timeline.ts";
import type { TtsProvider } from "./tts.ts";

/** `docs/videos/<locale>/voice.json`. */
export const VOICE_CONFIG = "voice.json";

export interface VoiceConfig {
  provider: "grok" | "tone";
  voice: string;
  language: string;
  /** Spelling → reading, applied longest first (e.g. "AI-DLC" → "エーアイディーエルシー"). */
  readings: Record<string, string>;
  /** Stop before spending more than this on one run (USD). */
  budgetUsd: number;
}

export function parseVoiceConfig(value: unknown): VoiceConfig {
  const v = (value ?? {}) as Record<string, unknown>;
  const provider = v.provider ?? "grok";
  if (provider !== "grok" && provider !== "tone")
    throw new Error("voice.json: provider must be grok or tone");
  if (typeof v.voice !== "string" || v.voice === "") throw new Error("voice.json: voice");
  if (typeof v.language !== "string" || v.language === "") throw new Error("voice.json: language");
  const readings = v.readings ?? {};
  if (
    typeof readings !== "object" ||
    readings === null ||
    Array.isArray(readings) ||
    !Object.values(readings).every((r) => typeof r === "string")
  ) {
    throw new Error("voice.json: readings must map text to text");
  }
  const budgetUsd = v.budgetUsd ?? 2;
  if (typeof budgetUsd !== "number" || !(budgetUsd > 0)) throw new Error("voice.json: budgetUsd");
  return {
    provider,
    voice: v.voice,
    language: v.language,
    readings: readings as Record<string, string>,
    budgetUsd,
  };
}

/** Find `voice.json` in the page directory or the nearest parent. */
export async function loadVoiceConfig(pageDir: string): Promise<VoiceConfig> {
  let dir = path.resolve(pageDir);
  for (;;) {
    const file = path.join(dir, VOICE_CONFIG);
    if (existsSync(file)) return parseVoiceConfig(JSON.parse(await readFile(file, "utf8")));
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`no ${VOICE_CONFIG} above ${pageDir}`);
    dir = parent;
  }
}

/** What the narrator says for a caption: its `speech`, or the caption with readings applied. */
export function speechFor(cue: StoryCue, readings: Record<string, string>): string {
  if (cue.speech !== undefined) return plainTextForSpeech(cue.speech);
  let text = plainTextForSpeech(cue.text);
  const spellings = Object.keys(readings).sort((a, b) => b.length - a.length || a.localeCompare(b));
  for (const spelling of spellings) text = text.split(spelling).join(readings[spelling]);
  return text;
}

/** Cache file name for one clip: every input that changes the audio is in the key. */
export function clipKey(
  providerId: string,
  config: Pick<VoiceConfig, "voice" | "language">,
  text: string,
): string {
  return createHash("sha256")
    .update([providerId, config.voice, config.language, text].join("\u0000"))
    .digest("hex")
    .slice(0, 16);
}

interface Clip {
  chapter: number;
  cue: number;
  text: string;
  file: string;
}

function clipsFor(
  storyboard: Storyboard,
  providerId: string,
  config: VoiceConfig,
  cacheDir: string,
): Clip[] {
  return storyboard.chapters.flatMap((chapter, c) =>
    chapter.cues.map((cue, i) => {
      const text = speechFor(cue, config.readings);
      return {
        chapter: c,
        cue: i,
        text,
        file: path.join(cacheDir, `${clipKey(providerId, config, text)}.wav`),
      };
    }),
  );
}

/** Characters still to synthesize for a page (cached clips are free). */
export function pendingCharacters(
  storyboard: Storyboard,
  providerId: string,
  config: VoiceConfig,
  cacheDir: string,
): number {
  return clipsFor(storyboard, providerId, config, cacheDir)
    .filter((clip) => !existsSync(clip.file))
    .reduce((sum, clip) => sum + [...clip.text].length, 0);
}

export async function readStoryboard(pageDir: string): Promise<Storyboard> {
  const parsed = parseStoryboard(
    JSON.parse(await readFile(path.join(pageDir, VIDEO_FILES.storyboard), "utf8")),
  );
  if (!parsed.ok) throw new Error(`storyboard: ${parsed.error}`);
  return parsed.value;
}

/**
 * Run `task` over `items` with at most `limit` in flight. After the first
 * failure no new item starts, and the failure is rethrown only once every
 * running task has settled — so a caller never sees the error while other
 * clips are still being written (and cleaned up) behind its back.
 */
async function pool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failed && next < items.length) {
      const item = items[next++] as T;
      try {
        await task(item);
      } catch (cause) {
        failed = true;
        throw cause;
      }
    }
  });
  const results = await Promise.allSettled(workers);
  const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failure !== undefined) throw failure.reason;
}

export interface VoiceResult {
  timeline: Timeline;
  synthesized: number;
  cached: number;
}

export async function voicePage(
  pageDir: string,
  deps: {
    provider: TtsProvider;
    config: VoiceConfig;
    audio: AudioOps;
    cacheDir: string;
    concurrency?: number;
  },
): Promise<VoiceResult> {
  const storyboard = await readStoryboard(pageDir);
  const clips = clipsFor(storyboard, deps.provider.id, deps.config, deps.cacheDir);
  await mkdir(deps.cacheDir, { recursive: true });
  // Identical captions share one clip: synthesize each file once, never from two workers.
  const unique = [...new Map(clips.map((clip) => [clip.file, clip])).values()];
  let synthesized = 0;
  await pool(unique, deps.concurrency ?? 4, async (clip) => {
    if (existsSync(clip.file)) return;
    const raw = await deps.provider.synthesize({
      text: clip.text,
      voice: deps.config.voice,
      language: deps.config.language,
    });
    // Write beside the cache entry, then rename: an interrupted run never
    // leaves a half-written clip that later runs would trust.
    const partial = `${clip.file.slice(0, -".wav".length)}.${process.pid}.partial.wav`;
    try {
      await deps.audio.trim(raw, partial);
      await rename(partial, clip.file);
    } finally {
      await rm(partial, { force: true });
    }
    synthesized++;
  });
  const lengths: number[][] = storyboard.chapters.map((chapter) => chapter.cues.map(() => 0));
  for (const clip of clips) {
    const row = lengths[clip.chapter] as number[];
    row[clip.cue] = await deps.audio.duration(clip.file);
  }
  const timeline = buildTimeline(storyboard, lengths);
  await writeFile(
    path.join(pageDir, VIDEO_FILES.timeline),
    `${JSON.stringify(timeline, null, 2)}\n`,
  );
  await writeFile(path.join(pageDir, VIDEO_FILES.captions), captionsVtt(storyboard, timeline));
  const starts = globalCues(storyboard, timeline).map((c) => c.start);
  await deps.audio.mix(
    clips.map((clip, i) => ({ file: clip.file, start: starts[i] ?? 0 })),
    timeline.duration,
    path.join(pageDir, VIDEO_FILES.narration),
  );
  return { timeline, synthesized, cached: unique.length - synthesized };
}
