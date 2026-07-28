/**
 * `Promise.all(items.map(fn))` with at most `limit` calls in flight. Results
 * keep item order, so callers that assemble deterministically from a sorted
 * input list (R-RC-5) stay deterministic. Exists because an unbounded map over
 * N intents × M audit shards × up-to-10MB reads turns "parallel" into "hold
 * the whole corpus' file handles at once".
 *
 * Rejects on the first failing call, like `Promise.all` — callers that must
 * not fail wholesale already wrap each item in a Result.
 */
export async function mapBounded<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
