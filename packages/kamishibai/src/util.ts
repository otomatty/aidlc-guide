/**
 * Seeded pseudo-random numbers in [0, 1). Use instead of Math.random so a frame
 * stays a pure function of time.
 */
export function random(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Apply `fn(node, at, i)` to each node, starting at `start` and `gap` seconds apart. */
export function stagger<T>(
  nodes: T[],
  start: number,
  gap: number,
  fn: (node: T, at: number, i: number) => void,
): T[] {
  nodes.forEach((node, i) => fn(node, start + i * gap, i));
  return nodes;
}
