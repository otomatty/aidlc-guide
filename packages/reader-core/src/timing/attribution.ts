import type { AuditEvent } from "@aidlc-guide/shared-types";
import type { RunBoundary } from "./pairing.ts";

/**
 * L3 — time attribution (pass 2 of 2). Pure aside from the injected `now`:
 * no filesystem, no clock read of its own. Given pass 1's (`./pairing.ts`)
 * sorted event stream and run boundaries, decides which open run accrues
 * each interval of wall time, under concurrent unit-major runs, silent
 * tails, and pre-start events. Knows nothing about *pairing* decisions — it
 * never opens, closes, abandons or discards a run; it only walks the
 * boundaries pass 1 already decided and bills time against them.
 */

/**
 * Gaps longer than this are treated as the human being away.
 *
 * ponytail: each gap is CAPPED at this value rather than dropped. A stage that
 * spends 26 minutes on one silent generation emits few audit events; dropping
 * over-threshold gaps would report it as ~1 minute and erase the very number
 * this feature exists to show. Capping bounds the error at one threshold per
 * gap in both directions. Tune if stages start emitting events on a different
 * cadence.
 *
 * `pairing.ts` also imports this to bound its clock-skew recovery window —
 * a different use of the same "a gap this large means something else is
 * going on" number, not a second definition of it.
 */
export const IDLE_THRESHOLD_MS = 10 * 60_000;

interface RunState {
  boundary: RunBoundary;
  prevMs: number;
  activeMs: number;
  eventCount: number;
}

export interface RunAttribution {
  wallMs: number;
  activeMs: number;
  eventCount: number;
}

export interface AttributionResult {
  /** Every boundary pass 1 produced gets an entry, including
   *  `abandoned`/`skipped` ones — composition in `derive.ts` decides which
   *  dispositions are worth reporting. */
  results: Map<RunBoundary, RunAttribution>;
  warnings: string[];
}

/**
 * Advances `run`'s own gap cursor to `at`, crediting the capped gap as
 * active time and counting this event towards it. Only ever called on the
 * run an event is attributed to — see `advanceCursors` below for how every
 * OTHER open run's cursor stays current without accruing anything.
 */
function applyGap(run: RunState, at: number): void {
  run.activeMs += Math.min(at - run.prevMs, IDLE_THRESHOLD_MS);
  run.prevMs = at;
  run.eventCount += 1;
}

/**
 * Codex round 7, finding 2: advances EVERY currently-open run's gap cursor
 * to `at`. Only `target` (the run this event is attributed to, or
 * `undefined` if none) actually accrues the interval as active time via
 * `applyGap`; every other open run's `prevMs` simply jumps to `at` with no
 * `activeMs`/`eventCount` change.
 *
 * Why this is required and not merely tidy: before this, a run's `prevMs`
 * only ever moved on an event THAT run was attributed to. A run left open
 * while a different, later-opened stage became the real attribution target
 * (unit-major's cascading gates) had its `prevMs` frozen at whatever event
 * it last received. The next time it WAS attributed — typically its own
 * STAGE_COMPLETED — `applyGap` computed the gap against that stale cursor,
 * so the entire stretch during which the OTHER stage was actually being
 * worked got billed to this run too. Same wall-clock minutes, charged to
 * two runs' `activeMs` at once.
 *
 * With every open run's cursor kept current, a run only ever accrues the
 * span between two events for which IT was the target — never a span some
 * other run was the target for. At most one run is `target` per event, so
 * for any given inter-event interval either exactly one run bills it (via
 * `applyGap`) or none do; no interval is ever billed twice. Since each
 * run's own capped, non-negative gaps still sum to no more than its own
 * wallMs, that "at most one biller per interval" property is exactly what
 * keeps the SUM of several open runs' activeMs bounded by the wall time of
 * the span they jointly cover.
 */
function advanceCursors(
  openRuns: Map<string, RunState>,
  at: number,
  target: RunState | undefined,
): void {
  for (const run of openRuns.values()) {
    if (run === target) {
      applyGap(run, at);
    } else {
      run.prevMs = at;
    }
  }
}

export function attributeRuns(
  events: readonly AuditEvent[],
  boundaries: readonly RunBoundary[],
  now: number,
): AttributionResult {
  const warnings: string[] = [];
  const results = new Map<RunBoundary, RunAttribution>();

  const openAt = new Map<number, RunBoundary>();
  const closeAt = new Map<number, RunBoundary>();
  for (const boundary of boundaries) {
    if (boundary.openIndex !== null) openAt.set(boundary.openIndex, boundary);
    if (boundary.closeIndex !== null) closeAt.set(boundary.closeIndex, boundary);
    if (boundary.openIndex === null) {
      // `recovered-completed`/`recovered-skipped`: pairing already decided
      // this run's open interval is empty (its terminal was consumed the
      // instant the reversed STAGE_STARTED arrived). It never occupies an
      // `openRuns` slot below, so it never accrues a gap — zero `activeMs`
      // falls out with no special case. `wallMs` still needs the same
      // clock-skew clamp a still-open run's `wallMs` gets (below): the
      // recovered pair's "end" timestamp is, by construction, at or before
      // its "start" timestamp (that reversal is *why* it needed recovering),
      // so a bare subtraction would go negative.
      const endMs = boundary.endedAt !== null ? Date.parse(boundary.endedAt) : boundary.startMs;
      results.set(boundary, {
        wallMs: Math.max(0, endMs - boundary.startMs),
        activeMs: 0,
        eventCount: 0,
      });
    }
  }

  // Currently-open run state per stage, driven entirely by the boundaries
  // pass 1 already decided (`openAt`/`closeAt`) rather than by re-inspecting
  // event types for pairing decisions. Map iteration order is insertion
  // order, and re-inserting a key (an abandon-then-reopen) moves it to the
  // end — "most recently opened" falls out of a plain
  // `for...of openRuns.values()` walk, mirroring pairing's own
  // `openBoundaries` map (see the Finding 1 comment there) exactly because
  // this map opens/closes stages in the identical relative sequence.
  const openRuns = new Map<string, RunState>();
  // Codex round 11, finding 2: the run the tail (last event → `now`) is
  // billed to. Tracks the run that was actually last credited via
  // `applyGap`, NOT `mostRecentlyOpened()` — during unit-major's late gate
  // cascade a stage-keyed event can target an EARLIER-opened stage while a
  // later-opened one sits idle waiting on its own gate; `mostRecentlyOpened()`
  // would then hand the tail to the idle stage just because it opened later,
  // never having done any of the work. Updated at every point this file
  // actually bills a run and consumed only at the very end, guarded by an
  // "is this run still open" check in case the last-attributed run has since
  // closed.
  let lastAttributed: RunState | undefined;

  /** Last-inserted (= most recently opened) entry still in `openRuns`. */
  function mostRecentlyOpened(): RunState | undefined {
    let last: RunState | undefined;
    for (const run of openRuns.values()) last = run;
    return last;
  }

  for (const [index, event] of events.entries()) {
    const at = Date.parse(event.timestamp); // always valid: pairing already rejected NaN timestamps

    const closing = closeAt.get(index);
    const opening = openAt.get(index);

    // Structural removal of an abandoned/skipped boundary happens BEFORE
    // this instant's billing, mirroring the original single-loop's
    // delete-then-advance order for a double-START. (Observably identical
    // either way — the removed run's own numbers are discarded regardless —
    // but a closed-then-billed `recovered-*` boundary never reaches here at
    // all, since `openIndex === null` for those means it was never inserted
    // into `openRuns` to begin with.)
    if (
      closing !== undefined &&
      closing.disposition !== "completed" &&
      closing.openIndex !== null
    ) {
      const run = openRuns.get(closing.stage);
      if (run !== undefined) {
        results.set(closing, {
          wallMs: at - closing.startMs,
          activeMs: run.activeMs,
          eventCount: run.eventCount,
        });
      }
      openRuns.delete(closing.stage);
    }

    // activeMs ATTRIBUTION RULE. Only lifecycle events (STARTED/COMPLETED/
    // SKIPPED) carry a `**Stage**` field in the audit log — everything else
    // (ARTIFACT_CREATED, sensor events, ...) is written with `stage: null`.
    // So "attribute an event to every open run when it names no stage"
    // would, in practice, credit *every* concurrently-open design stage
    // with *all* of the block's wall time — multiply-counting the same
    // minutes across 2-4 runs and breaking activeMs <= wallMs nowhere near
    // the edges, just routinely. Instead: an event that names a stage is
    // credited to that stage's own open run when it has one; an event that
    // names no stage (the common case) is credited to the MOST RECENTLY
    // OPENED run only. That matches how unit-major actually executes:
    // within a Unit the four design stages run one at a time in graph order
    // even though earlier ones stay open pending their cascade gate, so
    // whichever stage opened last is the one real work is currently
    // landing against.
    let target: RunState | undefined;
    if (event.event === "STAGE_COMPLETED") {
      // A STAGE_COMPLETED bills the run it closes, and ONLY that run —
      // never `mostRecentlyOpened()`, even when it names no stage (which
      // cannot happen for a *matched* completion, since a match requires a
      // named, open stage) or names a stage with nothing open for it. A
      // completion that named a stage is evidence of work on THAT stage,
      // not on whichever run happens to still be open; pairing.ts already
      // declined to create a boundary for a mismatched one for the same
      // reason (see the comment there) — crediting it here to some other
      // run would double-count once/if it later recovers into its own
      // (typically zero-duration) run via pairing's Part 2.
      target = closing?.disposition === "completed" ? openRuns.get(closing.stage) : undefined;
    } else if (event.event === "STAGE_STARTED" || event.event === "STAGE_SKIPPED") {
      // Neither ever bills anyone itself — a START marks work moving onto a
      // brand-new run, not activity on an existing one, and a SKIP's run is
      // being discarded, not billed — but every OTHER run left open through
      // either still needs its cursor caught up (Codex round 7 finding 2, in
      // `advanceCursors` below), or a later gap on one of them would
      // silently span the whole time this event's own stage was the real
      // attribution target.
      target = undefined;
    } else {
      // Codex round 10: the fallback to `mostRecentlyOpened()` must fire
      // ONLY when the event names no stage at all (`event.stage === null`)
      // — NOT whenever `openRuns.get(event.stage)` comes back empty.
      // stage-protocol.md (unit-major iteration) states a stage's own
      // STAGE_STARTED can legally land AFTER that stage's per-Unit artifact
      // events, so a stage-keyed event with no open run yet is expected,
      // not an anomaly. Falling back to `mostRecentlyOpened()` for it would
      // charge the interval to a DIFFERENT, earlier stage that's merely
      // still open for its own late cascade gate — stealing both activeMs
      // and eventCount from the stage that actually did the work. There is
      // no run to correctly bill this event to yet, so it is left
      // unattributed: `advanceCursors` still moves every open run's cursor
      // past it (nobody banks the interval for later), but nobody's
      // activeMs or eventCount grows.
      target = event.stage !== null ? openRuns.get(event.stage) : mostRecentlyOpened();
    }

    advanceCursors(openRuns, at, target);
    if (target !== undefined) lastAttributed = target;

    if (closing !== undefined && closing.disposition === "completed") {
      const run = openRuns.get(closing.stage);
      if (run !== undefined) {
        results.set(closing, {
          wallMs: at - closing.startMs,
          activeMs: run.activeMs,
          eventCount: run.eventCount,
        });
      }
      openRuns.delete(closing.stage);
    }

    if (opening !== undefined) {
      openRuns.set(opening.stage, {
        boundary: opening,
        prevMs: at,
        activeMs: 0,
        eventCount: 0,
      });
    }
  }

  // Zero, one, or several runs can still be open at `now` (the unit-major
  // cascade hasn't reached this stage's gate yet). Each gets the same tail
  // treatment the single-run case always did, independently — there is no
  // shared "the" open run to special-case.
  //
  // Codex round 9, finding 1: "each" does NOT mean "every open run bills the
  // tail". The tail (last event → `now`) is one span of wall time, and per
  // the attribution rule above, at most one run is ever the real target for
  // a span with no event naming a different one. Crediting the tail to
  // EVERY open run billed the same wall-clock minutes to two or more runs
  // at once — the tail-specific version of the bug `advanceCursors` already
  // fixes for in-loop gaps.
  //
  // Codex round 11, finding 2: that "one real target" is `lastAttributed`,
  // NOT `mostRecentlyOpened()`. Guarded by an identity check against
  // `openRuns`, not just presence: if the last-attributed run has SINCE
  // closed — or, more precisely, isn't the run currently occupying that
  // stage's slot — there is no still-open run that was ever actually
  // credited, so this falls back to `mostRecentlyOpened()`, same as when
  // nothing has been attributed yet at all (`lastAttributed` still
  // `undefined`).
  const tailTarget =
    lastAttributed !== undefined && openRuns.get(lastAttributed.boundary.stage) === lastAttributed
      ? lastAttributed
      : mostRecentlyOpened();

  for (const run of openRuns.values()) {
    const boundary = run.boundary;
    // The reader's clock and the writer's clock are not the same clock; a
    // negative elapsed is skew, not a negative duration.
    if (now < boundary.startMs) {
      warnings.push(`clock skew: run ${boundary.stage} starts after now, wallMs clamped to 0`);
    }
    // The tail: from the last event to `now`, under the same idle cap the
    // loop applies between events. Without this, an open run's activeMs
    // freezes at whatever it was after the last audit event — a stage
    // generating silently for twenty minutes would show a stuck elapsed
    // time until the next event lands. `Math.max(0, …)` guards the same
    // clock-skew case as `wallMs` below. Only `tailTarget` accrues it —
    // every other open run gets 0 here, exactly like `advanceCursors`'
    // non-target branch: its `activeMs` is already correctly scoped to
    // spans where IT was the target, and the tail span is not one of them.
    const finalGapMs = run === tailTarget ? Math.max(0, now - run.prevMs) : 0;
    const wallMs = Math.max(0, now - boundary.startMs);
    // Skew can also land entirely between two real events (the writer's
    // clock ahead of the reader's), which the per-gap `now - prevMs` clamp
    // above does not touch — those gaps are between two writer timestamps,
    // not against `now`. Re-clamping the total to `wallMs` here catches
    // that case without having to special-case it in the loop. A closed
    // run needs no equivalent: both its wallMs and activeMs derive solely
    // from the run's own event timestamps, never from `now`, so
    // activeMs <= wallMs already holds there by construction (each gap is
    // non-negative and capped).
    const activeMs = Math.min(run.activeMs + Math.min(finalGapMs, IDLE_THRESHOLD_MS), wallMs);
    results.set(boundary, { wallMs, activeMs, eventCount: run.eventCount });
  }

  return { results, warnings };
}
