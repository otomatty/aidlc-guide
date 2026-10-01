import { lerp } from "./ease.ts";

/** r, g, b in 0..255 and alpha in 0..1. */
type Rgba = readonly [number, number, number, number];

const colorCache = new Map<string, Rgba | null>();

/** Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(...)` or `rgba(...)`. Anything else is null. */
export function parseColor(value: unknown): Rgba | null {
  if (typeof value !== "string") return null;
  const cached = colorCache.get(value);
  if (cached !== undefined) return cached;
  let color: Rgba | null = null;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(value);
  const fn = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (hex?.[1] !== undefined && [3, 4, 6, 8].includes(hex[1].length)) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((x) => x + x).join("");
    const n = Number.parseInt(h.slice(0, 6), 16);
    const alpha = h.length === 8 ? Number.parseInt(h.slice(6), 16) / 255 : 1;
    color = [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
  } else if (fn?.[1] !== undefined) {
    const parts = fn[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    const [r, g, b, a = 1] = parts;
    if (
      r !== undefined &&
      g !== undefined &&
      b !== undefined &&
      [r, g, b, a].every(Number.isFinite)
    ) {
      color = [r, g, b, a];
    }
  }
  colorCache.set(value, color);
  return color;
}

function colorString(c: Rgba): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Number(c[3].toFixed(3))})`;
}

/** Multiply a color's alpha by `alpha`. Unparseable colors are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return c ? colorString([c[0], c[1], c[2], c[3] * alpha]) : color;
}

/**
 * Interpolate two property values at progress `p`.
 * Numbers lerp, equal-length arrays lerp element-wise, colors lerp in RGBA;
 * anything else (text, functions, null) switches to `b` only at the end.
 */
export function interpolate<T>(a: T, b: T, p: number): T {
  if (typeof a === "number" && typeof b === "number") return lerp(a, b, p) as T;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.map((v: unknown, i) => interpolate(v, b[i] as unknown, p)) as T;
  }
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (ca && cb) {
    return colorString(
      [0, 1, 2, 3].map((i) => lerp(ca[i] ?? 0, cb[i] ?? 0, p)) as unknown as Rgba,
    ) as T;
  }
  return p >= 1 ? b : a;
}
