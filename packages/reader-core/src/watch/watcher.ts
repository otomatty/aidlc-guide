import path from "node:path";
import type { ChangeEvent, WatchEvent } from "@aidlc-guide/shared-types";
import { watch as chokidarWatch, type FSWatcher } from "chokidar";
import { AUDIT_DIRNAME } from "../audit/events.ts";
import { STATE_FILENAME } from "../parse/state.ts";
import { CONSTRUCTION_DIRNAME } from "../tree/matrix.ts";

/** L5 — chokidar subscription, debounce, scope classification, resubscribe. */

export type Scope = ChangeEvent["scope"];

export const DEFAULT_DEBOUNCE_MS = 300;
export const DEFAULT_MAX_RESUBSCRIBES = 3;

export interface WatchOptions {
  /** Trailing debounce window (P-RC-4 budgets 300ms). */
  debounceMs?: number;
  /** Resubscribe attempts before liveness is declared lost (R-RC-4). */
  maxResubscribes?: number;
}

/**
 * Which part of the model a changed path invalidates, or `null` when the path
 * is irrelevant. Pure — the consumer re-fetches exactly one scope, which is
 * what keeps the change path off the full-rescan budget (P-RC-2b).
 */
export function classifyScope(recordDir: string, changed: string): Scope | null {
  const rel = path.relative(path.resolve(recordDir), path.resolve(changed));
  if (rel === "" || path.isAbsolute(rel) || rel === ".." || rel.startsWith(`..${path.sep}`)) {
    return null;
  }
  const segments = rel.split(path.sep);
  const [head, next] = segments;
  if (segments.length === 1 && head === STATE_FILENAME) return "state";
  if (head === CONSTRUCTION_DIRNAME && next !== undefined) return `matrix:${next}`;
  if (head === AUDIT_DIRNAME) return "audit";
  return null;
}

export interface ChangeQueue {
  push(scope: Scope, changedPath: string): void;
  cancel(): void;
}

/**
 * Trailing debounce that coalesces a burst into **one event per scope**. Split
 * out from {@link watch} so the timing rule is testable with fake timers
 * without a real filesystem.
 */
export function createChangeQueue(
  debounceMs: number,
  emit: (event: ChangeEvent) => void,
): ChangeQueue {
  const pending = new Map<Scope, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    timer = null;
    const batch = [...pending.entries()];
    pending.clear();
    for (const [scope, changedPath] of batch) emit({ type: "change", scope, path: changedPath });
  };

  return {
    push(scope, changedPath) {
      pending.set(scope, changedPath);
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}

/**
 * Watch the three live regions of a record and report coalesced changes.
 *
 * Returns `dispose`. Disposal flips a flag *before* closing the watcher, so no
 * callback can fire after the consumer has let go (R-RC-4).
 */
export function watch(
  recordDir: string,
  cb: (event: WatchEvent) => void,
  options: WatchOptions = {},
): () => void {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxResubscribes = options.maxResubscribes ?? DEFAULT_MAX_RESUBSCRIBES;

  let disposed = false;
  let attempts = 0;
  let watcher: FSWatcher | null = null;

  const notify = (event: WatchEvent): void => {
    if (!disposed) cb(event);
  };
  const queue = createChangeQueue(debounceMs, notify);

  const targets = [
    path.join(recordDir, STATE_FILENAME),
    path.join(recordDir, CONSTRUCTION_DIRNAME),
    path.join(recordDir, AUDIT_DIRNAME),
  ];

  const subscribe = (): boolean => {
    try {
      const next = chokidarWatch(targets, { ignoreInitial: true });
      next.on("all", (_event, changed) => {
        if (disposed) return;
        const scope = classifyScope(recordDir, changed);
        if (scope !== null) queue.push(scope, changed);
      });
      next.on("error", onError);
      watcher = next;
      return true;
    } catch {
      return false;
    }
  };

  function onError(): void {
    if (disposed) return;
    void watcher?.close().catch(() => {});
    watcher = null;
    attempts += 1;
    if (attempts > maxResubscribes || !subscribe()) {
      // Never fail silently: the UI has to be able to say "no longer live".
      notify({ type: "watch-warning", reason: "resubscribe-failed" });
    }
  }

  if (!subscribe()) {
    notify({ type: "watch-warning", reason: "watcher-lost" });
    return () => {};
  }

  return () => {
    disposed = true;
    queue.cancel();
    void watcher?.close().catch(() => {});
    watcher = null;
  };
}
