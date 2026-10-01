import { clamp } from "./ease.ts";
import { Emitter } from "./emitter.ts";
import type { Ctx2D, Node } from "./node.ts";
import { Scene, type SceneOptions } from "./scene.ts";
import { Fonts, Group, Text, roundRectPath } from "./shapes.ts";
import { clearTextCaches, layoutText, plainText } from "./text-layout.ts";
import { toVTT } from "./vtt.ts";

/** The part of a canvas the stage uses — an HTMLCanvasElement or an OffscreenCanvas. */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): Ctx2D | null;
}

export interface CaptionStyle {
  size: number;
  weight: number | string;
  /** null uses `Fonts.body`. */
  family: string | null;
  color: string;
  emColor: string;
  background: string;
  radius: number;
  padX: number;
  padY: number;
  bottom: number;
  maxWidth: number;
  lineHeight: number;
  /** Fade in/out time in seconds. */
  fade: number;
  enabled: boolean;
}

export interface StageOptions {
  /** Logical size: every coordinate is in this space, whatever the pixel size. */
  width?: number;
  height?: number;
  fps?: number;
  /** Reading speed for `Scene.say` drafts, characters per second. */
  cps?: number;
  background?: string;
  captionStyle?: Partial<CaptionStyle>;
  pixelWidth?: number;
  pixelHeight?: number;
}

/** A caption in global time. */
export interface StageCue {
  text: string;
  start: number;
  end: number;
  scene: string;
}

export interface Chapter {
  name: string;
  title: string;
  start: number;
  duration: number;
}

type StageEvents = {
  time: [number];
  /** The caption changed during playback (not on seeks); null between captions. */
  cue: [StageCue | null];
  seek: [number];
};

interface Layout {
  duration: number;
  chapters: Chapter[];
  cues: StageCue[];
}

/**
 * The whole video: scenes laid end to end plus an overlay and the caption band.
 * `renderAt(t)` draws any time directly. The stage holds no clock of its own —
 * `Playback` drives it from the narration audio, so picture follows sound.
 */
export class Stage extends Emitter<StageEvents> {
  readonly canvas: CanvasLike;
  readonly ctx: Ctx2D;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly cps: number;
  background: string;
  readonly scenes: Scene[] = [];
  /** Drawn over every scene, in global time. */
  readonly overlay = new Group({ anchorX: 0, anchorY: 0 });
  readonly captionStyle: CaptionStyle;
  time = 0;
  pixelScale = 1;
  private layoutCache: Layout | null = null;
  /** undefined = unknown (just seeked), so the next caption is not announced as new. */
  private activeCue: StageCue | null | undefined = undefined;

  constructor(canvas: CanvasLike, opts: StageOptions = {}) {
    super();
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("Kamishibai: 2D canvas context is unavailable");
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = opts.width ?? 1920;
    this.height = opts.height ?? 1080;
    this.fps = opts.fps ?? 30;
    this.cps = opts.cps ?? 7;
    this.background = opts.background ?? "#000";
    this.captionStyle = {
      size: 40,
      weight: 500,
      family: null,
      color: "#fff",
      emColor: "#ffd400",
      background: "rgba(0,0,0,0.72)",
      radius: 12,
      padX: 36,
      padY: 16,
      bottom: 56,
      maxWidth: 1560,
      lineHeight: 1.5,
      fade: 0.18,
      enabled: true,
      ...opts.captionStyle,
    };
    this.setPixelSize(opts.pixelWidth ?? this.width, opts.pixelHeight ?? this.height);
  }

  scene(name: string, opts: SceneOptions = {}): Scene {
    const scene = new Scene(this, name, opts);
    this.scenes.push(scene);
    this.invalidate();
    return scene;
  }

  /** Mark scene timings stale (a scene or caption was added). */
  invalidate(): void {
    this.layoutCache = null;
  }

  private layout(): Layout {
    if (this.layoutCache !== null) return this.layoutCache;
    let t = 0;
    const chapters: Chapter[] = [];
    const cues: StageCue[] = [];
    for (const s of this.scenes) {
      s.start = t;
      const duration = s.duration;
      chapters.push({ name: s.name, title: s.title, start: t, duration });
      for (const c of s.cues)
        cues.push({ text: c.text, start: t + c.at, end: t + c.end, scene: s.name });
      t += duration;
    }
    cues.sort((a, b) => a.start - b.start);
    this.layoutCache = { duration: t, chapters, cues };
    return this.layoutCache;
  }

  get duration(): number {
    return this.layout().duration;
  }

  get chapters(): Chapter[] {
    return this.layout().chapters;
  }

  get cues(): StageCue[] {
    return this.layout().cues;
  }

  sceneAt(t: number): Scene | undefined {
    this.layout();
    return this.scenes.find((s) => t < s.start + s.duration) ?? this.scenes.at(-1);
  }

  cueAt(t: number): StageCue | null {
    const cues = this.cues;
    for (let i = cues.length - 1; i >= 0; i--) {
      const c = cues[i];
      if (c !== undefined && t >= c.start && t < c.end) return c;
    }
    return null;
  }

  /** Change the backing resolution; logical coordinates stay width × height. */
  setPixelSize(w: number, h: number): void {
    this.canvas.width = Math.round(w);
    this.canvas.height = Math.round(h);
    this.pixelScale = this.canvas.width / this.width;
    this.renderAt(this.time);
  }

  /** Draw time t. Pure: may be called for any t in any order. */
  renderAt(t: number): void {
    const ctx = this.ctx;
    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.width, this.height);
    const s = this.sceneAt(t);
    if (s === undefined) return;
    const local = t - s.start;
    const alpha = Math.min(
      1,
      s.fadeIn > 0 ? local / s.fadeIn : 1,
      s.fadeOut > 0 ? (s.duration - local) / s.fadeOut : 1,
    );
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    s.render(ctx, local);
    ctx.restore();
    this.overlay.render(ctx, t);
    this.drawCaption(ctx, t);
  }

  private drawCaption(ctx: Ctx2D, t: number): void {
    const st = this.captionStyle;
    if (!st.enabled) return;
    const cue = this.cueAt(t);
    if (cue === null) return;
    const alpha = clamp(Math.min(1, (t - cue.start) / st.fade, (cue.end - t) / st.fade), 0, 1);
    const family = st.family ?? Fonts.body;
    const font = `${st.weight} ${st.size}px ${family}`;
    let layout = layoutText(cue.text, font, font, st.maxWidth);
    let maxWidth = st.maxWidth;
    if (layout.lines.length > 1) {
      // Even out line lengths so the last line is not left with one or two characters.
      const total = layout.lines.reduce((sum, l) => sum + l.width, 0);
      const tryWidth = Math.min(st.maxWidth, total / layout.lines.length + st.size * 1.2);
      const balanced = layoutText(cue.text, font, font, tryWidth);
      if (balanced.lines.length === layout.lines.length) {
        layout = balanced;
        maxWidth = tryWidth;
      }
    }
    const lh = st.size * st.lineHeight;
    const w = layout.width + st.padX * 2;
    const h = layout.lines.length * lh + st.padY * 2;
    const x = (this.width - w) / 2;
    const y = this.height - st.bottom - h;
    ctx.save();
    ctx.globalAlpha = alpha;
    roundRectPath(ctx, x, y, w, h, st.radius);
    ctx.fillStyle = st.background;
    ctx.fill();
    new Text({
      text: cue.text,
      size: st.size,
      weight: st.weight,
      family,
      color: st.color,
      emColor: st.emColor,
      align: "center",
      maxWidth,
      lineHeight: st.lineHeight,
      x: this.width / 2,
      y: y + st.padY,
    }).render(ctx, 0);
    ctx.restore();
  }

  /** Jump to t. The caption under the playhead is not announced as a new one. */
  seek(t: number): void {
    this.activeCue = undefined;
    this.setTime(clamp(t, 0, this.duration), true);
    this.emit("seek", this.time);
  }

  /** Advance to t during playback, announcing caption changes. */
  update(t: number): void {
    this.setTime(clamp(t, 0, this.duration), false);
  }

  private setTime(t: number, seeking: boolean): void {
    this.time = t;
    this.renderAt(t);
    const cue = this.cueAt(t);
    if (cue !== this.activeCue) {
      const previous = this.activeCue;
      this.activeCue = cue;
      if (!seeking && previous !== undefined) this.emit("cue", cue);
    }
    this.emit("time", t);
  }

  /**
   * Preload every font the video draws with. A canvas silently falls back to
   * another font when the face is not loaded yet, which changes line breaks.
   */
  async loadFonts(): Promise<void> {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    const wanted = new Map<string, string>();
    const want = (font: string, text: string) => wanted.set(font, (wanted.get(font) ?? "") + text);
    const visit = (root: Node) =>
      root.walk((node) => {
        if (node instanceof Text) {
          const [font, emFont] = node.fonts(node.props);
          const text = node.allText();
          want(font, `${text}0123456789%`);
          if (emFont !== font) want(emFont, text);
        }
      });
    for (const s of this.scenes) visit(s.root);
    visit(this.overlay);
    const st = this.captionStyle;
    want(
      `${st.weight} ${st.size}px ${st.family ?? Fonts.body}`,
      this.cues.map((c) => plainText(c.text)).join(""),
    );
    await Promise.all(
      [...wanted].map(([font, text]) => document.fonts.load(font, text).catch(() => [])),
    );
    clearTextCaches();
    this.renderAt(this.time);
  }

  /** Captions as WebVTT. */
  toVTT(): string {
    return toVTT(this.cues);
  }
}
