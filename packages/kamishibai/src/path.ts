import { clamp, lerp } from "./ease.ts";

/** A polyline as a flat list: `[x0, y0, x1, y1, ...]`. */
export type Points = readonly number[];
type Pair = readonly [number, number];

function toPairs(points: Points): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push([points[i] ?? 0, points[i + 1] ?? 0]);
  }
  return out;
}

function segmentLengths(pairs: readonly Pair[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < pairs.length; i++) {
    const a = pairs[i - 1] as Pair;
    const b = pairs[i] as Pair;
    out.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return out;
}

export function pathLength(points: Points): number {
  return segmentLengths(toPairs(points)).reduce((sum, len) => sum + len, 0);
}

/** Position and heading (radians) at fraction `u` (0..1) of the way along the polyline. */
export function pathPoint(points: Points, u: number): { x: number; y: number; angle: number } {
  const pairs = toPairs(points);
  const first = pairs[0];
  if (first === undefined) return { x: 0, y: 0, angle: 0 };
  if (pairs.length === 1) return { x: first[0], y: first[1], angle: 0 };
  const lengths = segmentLengths(pairs);
  let target = clamp(u, 0, 1) * lengths.reduce((sum, len) => sum + len, 0);
  for (let i = 1; i < pairs.length; i++) {
    const a = pairs[i - 1] as Pair;
    const b = pairs[i] as Pair;
    const seg = lengths[i - 1] ?? 0;
    if (target <= seg || i === pairs.length - 1) {
      const k = seg === 0 ? 0 : clamp(target / seg, 0, 1);
      return {
        x: lerp(a[0], b[0], k),
        y: lerp(a[1], b[1], k),
        angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
      };
    }
    target -= seg;
  }
  // Unreachable: the loop always returns on its last segment.
  return { x: first[0], y: first[1], angle: 0 };
}

/** The stretch of the polyline between fractions `u0` and `u1`, as point pairs. */
export function subPath(points: Points, u0: number, u1: number): Pair[] {
  const pairs = toPairs(points);
  const lengths = segmentLengths(pairs);
  const total = lengths.reduce((sum, len) => sum + len, 0);
  const d0 = clamp(u0, 0, 1) * total;
  const d1 = clamp(u1, 0, 1) * total;
  const out: Pair[] = [];
  let acc = 0;
  for (let i = 1; i < pairs.length; i++) {
    const a = pairs[i - 1] as Pair;
    const b = pairs[i] as Pair;
    const seg = lengths[i - 1] ?? 0;
    const start = acc;
    const end = acc + seg;
    if (end >= d0 && start <= d1 && seg > 0) {
      const s = clamp((d0 - start) / seg, 0, 1);
      const e = clamp((d1 - start) / seg, 0, 1);
      const at = (k: number): Pair => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      if (out.length === 0) out.push(at(s));
      out.push(at(e));
    }
    acc = end;
  }
  return out;
}
