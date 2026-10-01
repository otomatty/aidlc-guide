import type { Storyboard, Timeline } from "@aidlc-guide/kamishibai/storyboard";
import { plainTextForSpeech } from "./speech.ts";

/**
 * Every time in a video comes from the length of its narration, never from an
 * LLM or a character count: for caption i of a chapter,
 *
 *   dur_i   = max(audio_i + hold, minCaption)
 *   start_0 = lead,  start_i = start_{i-1} + dur_{i-1} + gap
 *   chapter = start_{n-1} + dur_{n-1} + tail
 */
export interface TimingOptions {
  /** Caption stays up this long after the voice stops. */
  hold: number;
  /** Shortest a caption may be shown. */
  minCaption: number;
  /** Silence between captions. */
  gap: number;
  /** Chapter heading shown alone before the first caption. */
  lead: number;
  /** Pause after a chapter's last caption. */
  tail: number;
}

export const DEFAULT_TIMING: TimingOptions = {
  hold: 0.15,
  minCaption: 1.5,
  gap: 0.35,
  lead: 1,
  tail: 1,
};

/** Millisecond precision keeps the JSON readable and the sums exact enough. */
const ms = (seconds: number): number => Math.round(seconds * 1000) / 1000;

/**
 * Lay out a timeline from measured narration lengths: `audio[c][i]` is the
 * trimmed length in seconds of chapter c's caption i.
 */
export function buildTimeline(
  storyboard: Storyboard,
  audio: readonly (readonly number[])[],
  timing: TimingOptions = DEFAULT_TIMING,
): Timeline {
  if (audio.length !== storyboard.chapters.length) {
    throw new Error("one list of narration lengths per chapter is required");
  }
  let chapterStart = 0;
  const chapters = storyboard.chapters.map((chapter, c) => {
    const lengths = audio[c] ?? [];
    if (lengths.length !== chapter.cues.length) {
      throw new Error(`chapter ${chapter.id}: one narration length per caption is required`);
    }
    let at = timing.lead;
    const cues = lengths.map((seconds, i) => {
      if (!(seconds >= 0)) throw new Error(`chapter ${chapter.id}: caption ${i} has no length`);
      const start = ms(at);
      const end = ms(at + Math.max(seconds + timing.hold, timing.minCaption));
      at = end + timing.gap;
      return { start, end };
    });
    const duration = ms((cues.at(-1)?.end ?? timing.lead) + timing.tail);
    const out = { id: chapter.id, start: ms(chapterStart), duration, cues };
    chapterStart += duration;
    return out;
  });
  return { formatVersion: 1, duration: ms(chapterStart), chapters };
}

/**
 * Narration length estimated from the text — for drafts and placeholder audio
 * only, before real narration exists. ~7 characters a second is a calm
 * Japanese explainer pace.
 */
export function estimateSpeechSeconds(text: string, charsPerSecond = 7): number {
  return [...plainTextForSpeech(text)].length / charsPerSecond;
}
