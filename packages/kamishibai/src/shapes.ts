import { clamp } from "./ease.ts";
import { type BaseProps, type Ctx2D, Node } from "./node.ts";
import { type Points, subPath } from "./path.ts";
import { layoutText, plainText } from "./text-layout.ts";

/**
 * Font stacks. Nothing is bundled (it would dominate the pack size), so the
 * stacks name the Japanese UI fonts each OS ships; `Text.fit` absorbs the
 * width differences between them.
 */
export const Fonts = {
  display: '"Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", system-ui, sans-serif',
  body: '"Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Consolas, monospace',
};

export class Group extends Node {
  constructor(props: Partial<BaseProps> = {}, children: Node[] = []) {
    super(props);
    this.add(children);
  }
}

export function roundRectPath(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

interface PaintProps {
  fill: string | null;
  stroke: string | null;
  lineWidth: number;
  dash: number[] | null;
  dashOffset: number;
}

function paint(ctx: Ctx2D, p: PaintProps): void {
  if (p.fill) {
    ctx.fillStyle = p.fill;
    ctx.fill();
  }
  if (p.stroke && p.lineWidth > 0) {
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = p.lineWidth;
    if (p.dash?.length) {
      ctx.setLineDash(p.dash);
      ctx.lineDashOffset = p.dashOffset;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export interface RectProps extends BaseProps, PaintProps {
  w: number;
  h: number;
  radius: number;
}

export class Rect extends Node<RectProps> {
  protected override defaults(): Partial<RectProps> {
    return {
      w: 100,
      h: 100,
      radius: 0,
      fill: "#fff",
      stroke: null,
      lineWidth: 0,
      dash: null,
      dashOffset: 0,
    };
  }
  protected override draw(ctx: Ctx2D, p: RectProps): void {
    roundRectPath(ctx, -p.w * p.anchorX, -p.h * p.anchorY, p.w, p.h, p.radius);
    paint(ctx, p);
  }
}

export interface CircleProps extends BaseProps, PaintProps {
  r: number;
  /** 0..1 of the full turn, drawn clockwise from 12 o'clock (a pie when filled). */
  sweep: number;
}

export class Circle extends Node<CircleProps> {
  protected override defaults(): Partial<CircleProps> {
    return { r: 50, fill: "#fff", stroke: null, lineWidth: 0, sweep: 1, dash: null, dashOffset: 0 };
  }
  protected override draw(ctx: Ctx2D, p: CircleProps): void {
    const r = Math.max(0, p.r);
    ctx.beginPath();
    if (p.sweep >= 1) {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
      const a0 = -Math.PI / 2;
      if (p.fill) ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a0 + Math.PI * 2 * p.sweep);
      if (p.fill) ctx.closePath();
    }
    paint(ctx, p);
  }
}

export interface LineProps extends BaseProps {
  points: Points;
  color: string;
  width: number;
  /** Draw only the stretch between these fractions: animate `trimEnd` for a line being drawn. */
  trimStart: number;
  trimEnd: number;
  /** Arrowhead size in px at the end; 0 for none. */
  arrow: number;
  dash: number[] | null;
  dashOffset: number;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
}

export class Line extends Node<LineProps> {
  protected override defaults(): Partial<LineProps> {
    return {
      points: [0, 0, 100, 0],
      color: "#fff",
      width: 4,
      trimStart: 0,
      trimEnd: 1,
      arrow: 0,
      dash: null,
      dashOffset: 0,
      cap: "round",
      join: "round",
      anchorX: 0,
      anchorY: 0,
    };
  }
  protected override draw(ctx: Ctx2D, p: LineProps): void {
    if (p.trimEnd <= p.trimStart) return;
    const pts = subPath(p.points, p.trimStart, p.trimEnd);
    const first = pts[0];
    if (first === undefined || pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    for (const pt of pts.slice(1)) ctx.lineTo(pt[0], pt[1]);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.width;
    ctx.lineCap = p.cap;
    ctx.lineJoin = p.join;
    if (p.dash) {
      ctx.setLineDash(p.dash);
      ctx.lineDashOffset = p.dashOffset;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (p.arrow > 0) {
      const a = pts.at(-2) ?? first;
      const b = pts.at(-1) ?? first;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const s = p.arrow;
      ctx.beginPath();
      ctx.moveTo(b[0] + Math.cos(ang) * s * 0.35, b[1] + Math.sin(ang) * s * 0.35);
      ctx.lineTo(b[0] + Math.cos(ang + 2.5) * s, b[1] + Math.sin(ang + 2.5) * s);
      ctx.lineTo(b[0] + Math.cos(ang - 2.5) * s, b[1] + Math.sin(ang - 2.5) * s);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }
}

/** Shrink-to-fit: lower the size (down to `minSize`) until the text wraps to at most `maxLines`. */
export interface TextFit {
  maxLines: number;
  minSize: number;
}

export interface TextProps extends BaseProps {
  text: string;
  size: number;
  weight: number | string;
  family: string;
  color: string;
  /** Color of `**emphasised**` runs; null keeps `color`. */
  emColor: string | null;
  emWeight: number | string | null;
  align: "left" | "center" | "right";
  maxWidth: number;
  lineHeight: number;
  /** 0..1 of the characters shown, for a typewriter reveal. */
  reveal: number;
  fit: TextFit | null;
}

const FIT_STEP = 2;

/** Text with wrapping, Japanese line-start rules, `**emphasis**`, reveal and shrink-to-fit. */
export class Text<P extends TextProps = TextProps> extends Node<P> {
  protected override defaults(): Partial<P> {
    const defaults: Partial<TextProps> = {
      text: "",
      size: 40,
      weight: 400,
      family: Fonts.body,
      color: "#fff",
      emColor: null,
      emWeight: null,
      align: "left",
      maxWidth: 100000,
      lineHeight: 1.45,
      reveal: 1,
      fit: null,
      anchorX: 0,
      anchorY: 0,
    };
    return defaults as Partial<P>;
  }

  protected content(p: P): string {
    return String(p.text);
  }

  /** The font size actually drawn: `size`, or smaller when `fit` needs it. */
  fittedSize(p: P): number {
    if (p.fit === null) return p.size;
    const text = this.content(p);
    let size = p.size;
    while (size > p.fit.minSize) {
      const [font, emFont] = this.fontsAt(p, size);
      if (layoutText(text, font, emFont, p.maxWidth).lines.length <= p.fit.maxLines) break;
      size = Math.max(p.fit.minSize, size - FIT_STEP);
    }
    return size;
  }

  private fontsAt(p: P, size: number): [string, string] {
    return [`${p.weight} ${size}px ${p.family}`, `${p.emWeight ?? p.weight} ${size}px ${p.family}`];
  }

  /** [regular font, emphasis font] as CSS shorthands, at the fitted size. */
  fonts(p: P): [string, string] {
    return this.fontsAt(p, this.fittedSize(p));
  }

  /** All text this node can show over its lifetime (for font preloading). */
  allText(): string {
    const texts = [this.content(this.props), ...this.tweenTargets("text").map(String)];
    return plainText(texts.join(""));
  }

  protected override draw(ctx: Ctx2D, p: P): void {
    const size = this.fittedSize(p);
    const [font, emFont] = this.fontsAt(p, size);
    const layout = layoutText(this.content(p), font, emFont, p.maxWidth);
    const lh = size * p.lineHeight;
    let y = -lh * layout.lines.length * p.anchorY + lh / 2;
    let budget =
      p.reveal >= 1 ? Number.POSITIVE_INFINITY : Math.floor(layout.chars * clamp(p.reveal, 0, 1));
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const line of layout.lines) {
      let x = p.align === "center" ? -line.width / 2 : p.align === "right" ? -line.width : 0;
      for (const token of line.tokens) {
        if (budget <= 0) return;
        const chars = [...token.s];
        const shown = chars.length > budget ? chars.slice(0, budget).join("") : token.s;
        budget -= chars.length;
        ctx.font = token.em ? emFont : font;
        ctx.fillStyle = token.em && p.emColor ? p.emColor : p.color;
        ctx.fillText(shown, x, y);
        x += token.w;
      }
      y += lh;
    }
  }

  /** Laid-out size at time t (for positioning neighbours). */
  measure(t = 0): { width: number; height: number; lines: number; size: number } {
    const p = this.resolve(t);
    const size = this.fittedSize(p);
    const [font, emFont] = this.fontsAt(p, size);
    const layout = layoutText(this.content(p), font, emFont, p.maxWidth);
    return {
      width: layout.width,
      height: layout.lines.length * size * p.lineHeight,
      lines: layout.lines.length,
      size,
    };
  }
}

export interface CounterProps extends TextProps {
  value: number;
  format: (value: number) => string;
}

/** A number that tweens through `value` and prints via `format`. */
export class Counter extends Text<CounterProps> {
  protected override defaults(): Partial<CounterProps> {
    return { ...super.defaults(), value: 0, format: (v: number) => String(Math.round(v)) };
  }
  protected override content(p: CounterProps): string {
    return p.format(p.value);
  }
}

export interface ImageProps extends BaseProps {
  w: number;
  h: number;
}

/** A bitmap. `src` is a URL / data URI (loaded here) or an already-decoded image source. */
export class ImageNode extends Node<ImageProps> {
  private readonly img: CanvasImageSource | null;
  private loaded: boolean;
  /** Resolves once the image has loaded or failed; awaiting it avoids drawing a blank first frame. */
  readonly ready: Promise<void>;

  constructor(props: Partial<ImageProps> & { src: string | CanvasImageSource | null }) {
    const { src, ...rest } = props;
    super(rest);
    if (typeof src === "string") {
      if (typeof Image === "undefined") {
        this.img = null;
        this.loaded = false;
        this.ready = Promise.resolve();
      } else {
        const img = new Image();
        this.img = img;
        this.loaded = false;
        this.ready = new Promise((resolve) => {
          img.onload = () => {
            this.loaded = true;
            resolve();
          };
          img.onerror = () => resolve();
        });
        img.src = src;
      }
    } else {
      this.img = src;
      this.loaded = src !== null;
      this.ready = Promise.resolve();
    }
  }

  protected override defaults(): Partial<ImageProps> {
    return { w: 100, h: 100 };
  }

  protected override draw(ctx: Ctx2D, p: ImageProps): void {
    if (this.img !== null && this.loaded) {
      ctx.drawImage(this.img, -p.w * p.anchorX, -p.h * p.anchorY, p.w, p.h);
    }
  }
}

export type ShapeDraw = (ctx: Ctx2D, p: BaseProps, t: number) => void;

/** Free-form drawing: `draw(ctx, props, t)` with t in scene time. */
export class Shape extends Node {
  private readonly drawFn: ShapeDraw | undefined;

  constructor(props: Partial<BaseProps> & { draw?: ShapeDraw } = {}) {
    const { draw, ...rest } = props;
    super(rest);
    this.drawFn = draw;
  }

  protected override draw(ctx: Ctx2D, p: BaseProps, t: number): void {
    this.drawFn?.(ctx, p, t);
  }
}
