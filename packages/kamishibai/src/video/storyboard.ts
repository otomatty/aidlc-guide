/**
 * The two files a doc video is made of.
 *
 *  - storyboard.json — what is shown and said: chapters, their captions, and
 *    each chapter's scene template with its data. Written from the script;
 *    contains no times and no coordinates.
 *  - timeline.json — when: every chapter's and caption's start and end,
 *    computed from the measured length of the narration audio alone.
 *
 * Both come from a separately installed pack, so they are validated here
 * before anything is built from them.
 */

export interface StoryCue {
  /** On-screen caption; `**...**` marks emphasis. */
  text: string;
}

export interface StoryChapter {
  id: string;
  title: string;
  template: string;
  cues: StoryCue[];
  /** Template-specific; each template validates its own shape. */
  data: Record<string, unknown>;
}

export interface Storyboard {
  formatVersion: 1;
  /** DocPath of the page this video explains. */
  page: string;
  /** sha256 of the English original the script was written from (staleness key). */
  sourceHash: string;
  title: string;
  chapters: StoryChapter[];
}

/** Chapter-relative caption times, seconds. */
export interface TimelineCue {
  start: number;
  end: number;
}

export interface TimelineChapter {
  id: string;
  start: number;
  duration: number;
  cues: TimelineCue[];
}

export interface Timeline {
  formatVersion: 1;
  duration: number;
  chapters: TimelineChapter[];
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";
const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseStoryboard(value: unknown): Parsed<Storyboard> {
  if (!isRecord(value)) return fail("storyboard is not an object");
  if (value.formatVersion !== 1) return fail("storyboard formatVersion");
  if (!isText(value.page)) return fail("storyboard page");
  if (typeof value.sourceHash !== "string" || !/^[0-9a-f]{64}$/.test(value.sourceHash)) {
    return fail("storyboard sourceHash");
  }
  if (!isText(value.title)) return fail("storyboard title");
  if (!Array.isArray(value.chapters) || value.chapters.length === 0) {
    return fail("storyboard chapters");
  }
  const chapters: StoryChapter[] = [];
  for (const [i, ch] of value.chapters.entries()) {
    if (!isRecord(ch)) return fail(`chapter ${i} is not an object`);
    const { id, title, template, cues, data } = ch;
    if (!isText(id) || !isText(title) || !isText(template)) return fail(`chapter ${i} header`);
    if (chapters.some((c) => c.id === id)) return fail(`duplicate chapter ${id}`);
    if (!Array.isArray(cues) || cues.length === 0) return fail(`chapter ${id} cues`);
    const parsedCues: StoryCue[] = [];
    for (const cue of cues) {
      if (!isRecord(cue) || !isText(cue.text)) return fail(`chapter ${id} cue text`);
      parsedCues.push({ text: cue.text });
    }
    if (data !== undefined && !isRecord(data)) return fail(`chapter ${id} data`);
    chapters.push({ id, title, template, cues: parsedCues, data: data ?? {} });
  }
  const { page, sourceHash, title } = value;
  return { ok: true, value: { formatVersion: 1, page, sourceHash, title, chapters } };
}

export function parseTimeline(value: unknown): Parsed<Timeline> {
  if (!isRecord(value)) return fail("timeline is not an object");
  if (value.formatVersion !== 1) return fail("timeline formatVersion");
  if (!isTime(value.duration) || value.duration === 0) return fail("timeline duration");
  if (!Array.isArray(value.chapters) || value.chapters.length === 0) {
    return fail("timeline chapters");
  }
  const chapters: TimelineChapter[] = [];
  let expectedStart = 0;
  for (const [i, ch] of value.chapters.entries()) {
    if (!isRecord(ch)) return fail(`timeline chapter ${i} is not an object`);
    const { id, start, duration, cues } = ch;
    if (!isText(id) || !isTime(start) || !isTime(duration) || duration === 0) {
      return fail(`timeline chapter ${i} header`);
    }
    // Chapters are laid end to end; a gap or overlap means the file was edited by hand wrongly.
    if (Math.abs(start - expectedStart) > 0.01) return fail(`timeline chapter ${id} start`);
    expectedStart = start + duration;
    if (!Array.isArray(cues)) return fail(`timeline chapter ${id} cues`);
    const parsedCues: TimelineCue[] = [];
    for (const cue of cues) {
      if (!isRecord(cue) || !isTime(cue.start) || !isTime(cue.end) || cue.end <= cue.start) {
        return fail(`timeline chapter ${id} cue`);
      }
      if (cue.end > duration + 0.01) return fail(`timeline chapter ${id} cue past chapter end`);
      parsedCues.push({ start: cue.start, end: cue.end });
    }
    chapters.push({ id, start, duration, cues: parsedCues });
  }
  if (Math.abs(expectedStart - value.duration) > 0.01) return fail("timeline duration mismatch");
  return { ok: true, value: { formatVersion: 1, duration: value.duration, chapters } };
}
