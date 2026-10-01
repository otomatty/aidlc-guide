import type { Storyboard, Timeline } from "@aidlc-guide/kamishibai/storyboard";
import { toVTT } from "@aidlc-guide/kamishibai/vtt";

/** Caption text with global start/end times, in playback order. */
export function globalCues(
  storyboard: Storyboard,
  timeline: Timeline,
): { text: string; start: number; end: number }[] {
  return storyboard.chapters.flatMap((chapter, c) => {
    const times = timeline.chapters[c];
    if (
      times === undefined ||
      times.id !== chapter.id ||
      times.cues.length !== chapter.cues.length
    ) {
      throw new Error(`timeline does not match storyboard at chapter ${chapter.id}`);
    }
    return chapter.cues.map((cue, i) => {
      const t = times.cues[i] as { start: number; end: number };
      return { text: cue.text, start: times.start + t.start, end: times.start + t.end };
    });
  });
}

/** captions.vtt for a video: the same captions the player draws, for sharing and transcripts. */
export function captionsVtt(storyboard: Storyboard, timeline: Timeline): string {
  return toVTT(globalCues(storyboard, timeline));
}
