import { interpolate } from "./color.ts";
import { clamp, type EaseFn, type EaseName, getEase } from "./ease.ts";
import { type Points, pathPoint } from "./path.ts";

/** Every 2D context Kamishibai can draw into (a page canvas or an OffscreenCanvas). */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface BaseProps {
  x: number;
  y: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
  visible: boolean;
  /** When set, the node rides this polyline at fraction `along`, offset by x/y. */
  path: Points | null;
  along: number;
  shadowColor: string;
  shadowBlur: number;
  shadowY: number;
  blend: GlobalCompositeOperation | null;
}

const BASE_DEFAULTS: BaseProps = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  visible: true,
  path: null,
  along: 0,
  shadowColor: "rgba(0,0,0,0)",
  shadowBlur: 0,
  shadowY: 0,
  blend: null,
};

export interface TweenOptions {
  /** Start time in seconds, relative to the scene. */
  at?: number;
  /** Duration in seconds; 0 switches instantly. */
  dur?: number;
  ease?: EaseName | EaseFn;
}

/** Offsets and curve for the enter/exit helpers. */
export interface MotionOptions {
  dx?: number;
  dy?: number;
  scale?: number;
  ease?: EaseName | EaseFn;
}

export interface LifeOptions extends MotionOptions {
  inDur?: number;
  outDur?: number;
}

interface Tween {
  at: number;
  dur: number;
  to: unknown;
  ease: EaseFn;
  /** Insertion order, the tie-break for tweens that start at the same time. */
  seq: number;
  /** The value when this tween starts, filled in by `prepare()`. */
  from: { value: unknown } | null;
}

let seqCounter = 0;

function evalTrack(base: unknown, track: readonly Tween[], t: number, n: number): unknown {
  let value = base;
  for (let i = 0; i < n; i++) {
    const w = track[i];
    if (w === undefined || t < w.at) break;
    const start = w.from === null ? value : w.from.value;
    const p = w.dur <= 0 ? 1 : clamp((t - w.at) / w.dur, 0, 1);
    value = interpolate(start, w.to, p >= 1 ? 1 : w.ease(p));
  }
  return value;
}

/**
 * Base of every drawable. Properties are animated by stacking time-stamped
 * tweens (`to` / `from` / `set`), and `render(ctx, t)` is a pure function of t:
 * any time can be drawn in any order, which is what makes seeking and
 * frame-by-frame export exact.
 */
export class Node<P extends BaseProps = BaseProps> {
  props: P;
  parent: Node | null = null;
  readonly children: Node[] = [];
  /** Keyed by property name; a plain string key keeps every `Node<P>` assignable to `Node`. */
  private readonly tracks = new Map<string, Tween[]>();
  private dirty = true;

  constructor(props: Partial<P> = {}) {
    this.props = { ...BASE_DEFAULTS, ...this.defaults(), ...props } as P;
  }

  /** Subclass defaults, layered between the base defaults and the caller's props. */
  protected defaults(): Partial<P> {
    return {};
  }

  /** Animate from the value at `opts.at` to `props` over `opts.dur` seconds. */
  to(props: Partial<P>, opts: TweenOptions = {}): this {
    const at = opts.at ?? 0;
    const dur = opts.dur ?? 0.6;
    const ease = getEase(opts.ease ?? "outCubic");
    for (const key of Object.keys(props) as (keyof P)[]) {
      const track = this.tracks.get(String(key)) ?? [];
      track.push({ at, dur, to: props[key], ease, seq: seqCounter++, from: null });
      this.tracks.set(String(key), track);
    }
    this.dirty = true;
    return this;
  }

  /** Animate from `props` to the current values (an entrance). */
  from(props: Partial<P>, opts: TweenOptions = {}): this {
    const target: Partial<P> = {};
    for (const key of Object.keys(props) as (keyof P)[]) {
      target[key] = this.props[key];
      this.props[key] = props[key] as P[keyof P];
    }
    return this.to(target, opts);
  }

  /** Switch to `props` instantly at time `at`. */
  set(props: Partial<P>, at = 0): this {
    return this.to(props, { at, dur: 0 });
  }

  fadeIn(at = 0, dur = 0.6, o: MotionOptions = {}): this {
    const f: Partial<BaseProps> = { opacity: 0 };
    if (o.dy) f.y = this.props.y + o.dy;
    if (o.dx) f.x = this.props.x + o.dx;
    if (o.scale !== undefined) f.scale = o.scale;
    return this.from(f as Partial<P>, { at, dur, ease: o.ease ?? "outCubic" });
  }

  fadeOut(at = 0, dur = 0.4, o: MotionOptions = {}): this {
    const t: Partial<BaseProps> = { opacity: 0 };
    // Relative to where the node is when it leaves, not to `props` (which an
    // earlier `from()` has rewound to the entrance values).
    if (o.dy) t.y = this.get("y", at) + o.dy;
    if (o.scale !== undefined) t.scale = o.scale;
    return this.to(t as Partial<P>, { at, dur, ease: o.ease ?? "inOutQuad" });
  }

  /** Enter at `inAt` and, when given, leave at `outAt`. */
  life(inAt: number, outAt?: number | null, o: LifeOptions = {}): this {
    this.fadeIn(inAt, o.inDur ?? 0.6, o);
    if (outAt !== undefined && outAt !== null) this.fadeOut(outAt, o.outDur ?? 0.4);
    return this;
  }

  pop(at = 0, dur = 0.5): this {
    return this.from({ scale: 0, opacity: 0 } as Partial<P>, { at, dur, ease: "outBack" });
  }

  add(...nodes: (Node | Node[])[]): this {
    for (const node of nodes.flat()) {
      node.parent = this;
      this.children.push(node);
    }
    return this;
  }

  /** Sort each track and record every tween's start value. Re-run after any new tween. */
  private prepare(): void {
    if (!this.dirty) return;
    for (const [key, track] of this.tracks) {
      track.sort((a, b) => a.at - b.at || a.seq - b.seq);
      for (const w of track) w.from = null;
      track.forEach((w, i) => {
        w.from = { value: evalTrack(this.props[key as keyof P], track, w.at, i) };
      });
    }
    this.dirty = false;
  }

  get<K extends keyof P>(key: K, t: number): P[K] {
    this.prepare();
    const track = this.tracks.get(String(key));
    return (track ? evalTrack(this.props[key], track, t, track.length) : this.props[key]) as P[K];
  }

  /** The values `key` is tweened to, in insertion order. */
  tweenTargets<K extends keyof P>(key: K): P[K][] {
    return (this.tracks.get(String(key)) ?? []).map((w) => w.to as P[K]);
  }

  /** Every property's value at time t. */
  resolve(t: number): P {
    this.prepare();
    const out = { ...this.props };
    for (const [name, track] of this.tracks) {
      const key = name as keyof P;
      out[key] = evalTrack(this.props[key], track, t, track.length) as P[keyof P];
    }
    return out;
  }

  /** When the last tween in this subtree finishes. */
  lastTime(): number {
    let last = 0;
    for (const track of this.tracks.values()) {
      for (const w of track) last = Math.max(last, w.at + w.dur);
    }
    for (const child of this.children) last = Math.max(last, child.lastTime());
    return last;
  }

  render(ctx: Ctx2D, t: number): void {
    const p = this.resolve(t);
    if (!p.visible || p.opacity <= 0.001) return;
    ctx.save();
    if (p.path) {
      const pt = pathPoint(p.path, p.along);
      ctx.translate(pt.x + p.x, pt.y + p.y);
    } else {
      ctx.translate(p.x, p.y);
    }
    if (p.rotation) ctx.rotate((p.rotation * Math.PI) / 180);
    const sx = p.scale * p.scaleX;
    const sy = p.scale * p.scaleY;
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    ctx.globalAlpha *= p.opacity;
    if (p.blend) ctx.globalCompositeOperation = p.blend;
    if (p.shadowBlur || p.shadowY) {
      ctx.shadowColor = p.shadowColor;
      ctx.shadowBlur = p.shadowBlur;
      ctx.shadowOffsetY = p.shadowY;
    }
    this.draw(ctx, p, t);
    ctx.shadowColor = "rgba(0,0,0,0)";
    for (const child of this.children) child.render(ctx, t);
    ctx.restore();
  }

  /** Draw this node itself in local coordinates; children are drawn by `render`. */
  protected draw(_ctx: Ctx2D, _p: P, _t: number): void {}

  /** Visit this node and every descendant. */
  walk(fn: (node: Node) => void): void {
    fn(this);
    for (const child of this.children) child.walk(fn);
  }
}
