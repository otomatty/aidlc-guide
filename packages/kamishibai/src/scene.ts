import type { Ctx2D, Node } from "./node.ts";
import { Group } from "./shapes.ts";
import { plainText } from "./text-layout.ts";

export interface SceneOptions {
  title?: string;
  /** Fixed length in seconds. Omit to end `tail` seconds after the last caption. */
  duration?: number;
  tail?: number;
  background?: string | null;
  fadeIn?: number;
  fadeOut?: number;
}

/** A caption in scene time. */
export interface SceneCue {
  text: string;
  at: number;
  dur: number;
  end: number;
}

export interface SayLine {
  text: string;
  at?: number;
  dur?: number;
  /** Extra silence after this line. */
  pause?: number;
}

export interface SayOptions {
  /** Reading speed in characters per second. */
  cps?: number;
  gap?: number;
  at?: number;
  /** Shortest a caption may stay up. */
  min?: number;
}

/** What a scene needs from its stage. */
export interface SceneHost {
  readonly cps: number;
  readonly width: number;
  readonly height: number;
  invalidate(): void;
}

/** One chapter: its own node tree and captions, timed from 0 at the chapter start. */
export class Scene {
  readonly name: string;
  readonly title: string;
  readonly tail: number;
  readonly background: string | null;
  readonly fadeIn: number;
  readonly fadeOut: number;
  readonly root = new Group({ anchorX: 0, anchorY: 0 });
  readonly cues: SceneCue[] = [];
  /** Global start time, assigned by the stage's layout pass. */
  start = 0;
  private readonly host: SceneHost;
  private readonly fixedDuration: number | null;

  constructor(host: SceneHost, name: string, opts: SceneOptions = {}) {
    this.host = host;
    this.name = name;
    this.title = opts.title ?? name;
    this.fixedDuration = opts.duration ?? null;
    this.tail = opts.tail ?? 1;
    this.background = opts.background ?? null;
    this.fadeIn = opts.fadeIn ?? 0.35;
    this.fadeOut = opts.fadeOut ?? 0.35;
  }

  add<T extends Node>(node: T): T {
    this.root.add(node);
    return node;
  }

  /** Add one caption at an explicit time — the path real timelines use. */
  caption(text: string, at: number, dur: number): SceneCue {
    const cue = { text, at, dur, end: at + dur };
    this.cues.push(cue);
    this.host.invalidate();
    return cue;
  }

  /**
   * Lay captions out back to back, estimating each length from the reading
   * speed. For drafting only: real videos take their times from the measured
   * narration (`caption`), never from a character count.
   */
  say(lines: (string | SayLine)[], o: SayOptions = {}): SceneCue[] {
    const cps = o.cps ?? this.host.cps;
    const gap = o.gap ?? 0.3;
    const last = this.cues.at(-1);
    let at = o.at ?? (last ? last.end + gap : 0.5);
    return lines.map((line) => {
      const item = typeof line === "string" ? { text: line } : line;
      if (item.at !== undefined) at = item.at;
      const dur = item.dur ?? Math.max(o.min ?? 2.6, [...plainText(item.text)].length / cps + 0.6);
      const cue = this.caption(item.text, at, dur);
      at = cue.end + (item.pause ?? 0) + gap;
      return cue;
    });
  }

  get duration(): number {
    if (this.fixedDuration !== null) return this.fixedDuration;
    const lastCue = this.cues.reduce((max, c) => Math.max(max, c.end), 0);
    return Math.max(lastCue + this.tail, 1);
  }

  render(ctx: Ctx2D, t: number): void {
    if (this.background) {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.host.width, this.host.height);
    }
    this.root.render(ctx, t);
  }
}
