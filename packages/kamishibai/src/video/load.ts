import type { Stage } from "../stage.ts";
import type { Parsed, Storyboard, Timeline } from "./storyboard.ts";
import { DEFAULT_THEME, TemplateDataError, templateFor, type VideoTheme } from "./templates.ts";

/**
 * Build a doc video onto an empty stage: one scene per chapter, timed by the
 * timeline (never by character counts), drawn by the chapter's template.
 */
export function loadVideo(
  stage: Stage,
  storyboard: Storyboard,
  timeline: Timeline,
  theme: VideoTheme = DEFAULT_THEME,
): Parsed<void> {
  if (stage.scenes.length > 0) return { ok: false, error: "stage already has scenes" };
  if (storyboard.chapters.length !== timeline.chapters.length) {
    return { ok: false, error: "storyboard and timeline disagree on the chapters" };
  }
  const plan = storyboard.chapters.map((chapter, i) => ({ chapter, times: timeline.chapters[i] }));
  for (const { chapter, times } of plan) {
    if (times?.id !== chapter.id)
      return { ok: false, error: `timeline has no chapter ${chapter.id} here` };
    if (times.cues.length !== chapter.cues.length) {
      return { ok: false, error: `chapter ${chapter.id}: caption count differs from the timeline` };
    }
    if (templateFor(chapter.template) === null) {
      return { ok: false, error: `chapter ${chapter.id}: unknown template ${chapter.template}` };
    }
  }

  stage.background = theme.background;
  try {
    plan.forEach(({ chapter, times }, i) => {
      if (times === undefined) return;
      const scene = stage.scene(chapter.id, { title: chapter.title, duration: times.duration });
      chapter.cues.forEach((cue, c) => {
        const t = times.cues[c];
        if (t !== undefined) scene.caption(cue.text, t.start, t.end - t.start);
      });
      const starts = times.cues.map((t) => t.start);
      templateFor(chapter.template)?.({
        scene,
        data: chapter.data,
        theme,
        width: stage.width,
        height: stage.height,
        chapterNo: i + 1,
        chapterTitle: chapter.title,
        cueCount: starts.length,
        cueAt: (k) => starts[Math.max(0, Math.min(k, starts.length - 1))] ?? 0,
      });
    });
  } catch (cause) {
    stage.scenes.splice(0);
    stage.invalidate();
    if (cause instanceof TemplateDataError) return { ok: false, error: cause.message };
    throw cause;
  }
  return { ok: true, value: undefined };
}
