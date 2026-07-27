import type { AuditEvent, StageTiming } from "@aidlc-guide/shared-types";
import { compareByTime } from "../audit/events.ts";

/**
 * L3 — stage run derivation. Pure: no filesystem, no clock. `now` is injected
 * so an open run measures deterministically under test.
 *
 * Nothing is recorded to produce this. The audit log already holds every
 * STAGE_STARTED/STAGE_COMPLETED pair; this only pairs them up.
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
 */
export const IDLE_THRESHOLD_MS = 10 * 60_000;

interface OpenRun {
  stage: string;
  startedAt: string;
  startMs: number;
  prevMs: number;
  activeMs: number;
  eventCount: number;
}

interface PendingCompletion {
  event: AuditEvent;
  at: number;
}

/**
 * Pairing-only refinement of `compareByTime`, local to this module.
 *
 * Two clones working the same workflow can stamp a stage's STAGE_COMPLETED
 * *earlier* than its own STAGE_STARTED — same-second ties (this log has
 * second resolution) or outright clock skew between shards. `compareByTime`'s
 * shard-name tiebreak has no opinion on lifecycle order, so on a same-second
 * tie it can sort the completion first; the pairing loop below then reads
 * STAGE_COMPLETED before STAGE_STARTED, discards the completion as unmatched,
 * and leaves the start open forever (it never sees a completion again).
 *
 * This is deliberately NOT folded into `compareByTime` in `../audit/events.ts`:
 * that comparator also drives `readAuditEvents`'s display order, which is
 * pinned by `audit.test.ts` and has no stake in STARTED-before-COMPLETED
 * lifecycle semantics — only the pairing loop here does. Keeping the rule
 * local means the display-order tests need no re-verification.
 *
 * Only fires for two events naming the *same* stage. The dominant real
 * pattern — a stage's STAGE_COMPLETED and the *next* stage's STAGE_STARTED
 * sharing a second — names two *different* stages, so it is untouched: the
 * fallback to `compareByTime` still puts the completion first there.
 */
function comparePairAware(a: AuditEvent, b: AuditEvent): number {
  if (a.stage !== null && a.stage === b.stage) {
    const aTime = Date.parse(a.timestamp);
    const bTime = Date.parse(b.timestamp);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime === bTime) {
      if (a.event === "STAGE_STARTED" && b.event === "STAGE_COMPLETED") return -1;
      if (a.event === "STAGE_COMPLETED" && b.event === "STAGE_STARTED") return 1;
    }
  }
  return compareByTime(a, b);
}

/**
 * Advances `run`'s own gap cursor to `at`, crediting the capped gap as
 * active time and counting this event towards it. Each run tracks its own
 * `prevMs` independently, so two runs open at once never both claim credit
 * for the same wall-clock gap — see the attribution-rule comment on the
 * `openRuns` declaration below for why only one run is ever the target.
 */
function applyGap(run: OpenRun, at: number): void {
  run.activeMs += Math.min(at - run.prevMs, IDLE_THRESHOLD_MS);
  run.prevMs = at;
  run.eventCount += 1;
}

export function deriveStageTimings(
  events: readonly AuditEvent[],
  now: number,
): { timings: StageTiming[]; warnings: string[] } {
  const timings: StageTiming[] = [];
  const warnings: string[] = [];
  // Finding 1 (unit-major iteration): several design stages can legitimately
  // be open at once — see stage-protocol.md's "Unit-major iteration" section.
  // A single global `open` slot abandoned every earlier stage the moment the
  // next one started; keying by stage lets each stay open until its OWN
  // STAGE_COMPLETED closes it, regardless of what else opened meanwhile. A
  // genuine double-START of the SAME stage still abandons and warns (below) —
  // only a *different* stage starting must leave existing opens undisturbed.
  //
  // Iteration order of a Map is insertion order, and re-inserting a key
  // (delete then set) moves it to the end — that is what lets "most
  // recently opened" fall out of a plain `for...of openRuns.values()` walk
  // instead of a separate stack.
  //
  // activeMs ATTRIBUTION RULE for events that aren't themselves a
  // STAGE_STARTED: only lifecycle events (STARTED/COMPLETED/SKIPPED) carry a
  // `**Stage**` field in the audit log — everything else (ARTIFACT_CREATED,
  // sensor events, ...) is written with `stage: null`. So "attribute an
  // event to every open run when it names no stage" would, in practice,
  // credit *every* concurrently-open design stage with *all* of the block's
  // wall time — multiply-counting the same minutes across 2-4 runs and
  // breaking activeMs <= wallMs nowhere near the edges, just routinely.
  // Instead: an event that names a stage is credited to that stage's own
  // open run when it has one; an event that names no stage (the common
  // case) is credited to the MOST RECENTLY OPENED run only. That matches
  // how unit-major actually executes: within a Unit the four design stages
  // run one at a time in graph order even though earlier ones stay open
  // pending their cascade gate, so whichever stage opened last is the one
  // real work is currently landing against. Each run keeps its own
  // `prevMs`, so crediting only one run per event keeps every run's
  // activeMs a sum of that run's own non-negative, capped gaps — bounded by
  // its own wallMs by construction, exactly as the single-run case already
  // was.
  const openRuns = new Map<string, OpenRun>();
  // STAGE_COMPLETEDs that found no matching open run for their own stage
  // (whether or not OTHER stages are open — see the finding-1 comment on
  // the STAGE_COMPLETED handling below), keyed by stage, waiting to see
  // whether a same-stage STAGE_STARTED shows up after them — the clock-skew
  // reversal case Part 2 recovers. A `null`-stage completion can't be keyed
  // this way and falls back to the plain unmatched warning immediately.
  const pendingCompletions = new Map<string, PendingCompletion>();

  /** Last-inserted (= most recently opened) entry still in `openRuns`. */
  function mostRecentlyOpened(): OpenRun | undefined {
    let last: OpenRun | undefined;
    for (const run of openRuns.values()) last = run;
    return last;
  }

  for (const event of [...events].sort(comparePairAware)) {
    // A `--single` stage-runner run (`/aidlc --stage <slug> --single`, or an
    // `/aidlc-<stage>` runner skill) is deliberately ISOLATED from the main
    // workflow — the engine itself never lets it advance `Current Stage`
    // (aidlc-orchestrate.ts). It still emits a real STAGE_STARTED/
    // STAGE_COMPLETED pair to `audit.md`, tagged `**Workflow**:
    // single-stage:<slug>`, and the engine's own report-floor logic
    // (aidlc-orchestrate.ts, `auditBlockField(...).startsWith("single-stage:")`)
    // skips that tag the same way. We mirror that predicate here: without it,
    // this synthetic STAGE_STARTED would abandon whatever main-workflow run
    // is genuinely open (destroying its measured duration) and the synthetic
    // STAGE_COMPLETED would register as a run of its own — a spurious sample
    // in the estimate pool for a stage nobody actually worked on right now.
    //
    // Residual limitation: only the lifecycle pair itself carries `Workflow`.
    // Other audit events a concurrent single-stage run emits (artifact
    // writes, sensor fires) do not, so if one runs while a main-workflow
    // stage is open, those events still land inside that stage's window and
    // inflate its `activeMs`. That's a bounded inaccuracy in a time estimate
    // — the human genuinely was doing something in that window — not the
    // total loss of a run that skipping the lifecycle pair prevents.
    if (event.workflow?.startsWith("single-stage:")) continue;

    const at = Date.parse(event.timestamp);
    if (Number.isNaN(at)) {
      warnings.push(`unparseable timestamp: ${event.timestamp}`);
      continue;
    }

    if (event.event === "STAGE_STARTED") {
      if (event.stage === null) {
        warnings.push(`STAGE_STARTED with no Stage field at ${event.timestamp}`);
        continue;
      }

      // Part 2: a completion for this exact stage already arrived with no
      // run open, and this start lands at or after it — the pairing that
      // `comparePairAware` could not fix because the two events landed in
      // different shards with disagreeing clocks, not merely tied. Recover
      // it as a zero-duration run instead of opening a run that will now
      // never see its (already-consumed) completion and stay open forever.
      const pending = pendingCompletions.get(event.stage);
      if (pending !== undefined && at >= pending.at) {
        pendingCompletions.delete(event.stage);
        warnings.push(
          `clock skew: STAGE_COMPLETED for ${event.stage} was recorded before its STAGE_STARTED (shards disagree on the clock) — closed as a zero-duration run`,
        );
        timings.push({
          stage: event.stage,
          startedAt: event.timestamp,
          endedAt: pending.event.timestamp,
          wallMs: 0,
          activeMs: 0,
          eventCount: 0,
        });
        continue;
      }

      // A same-stage double-START is still a genuine abandonment: the first
      // attempt never saw its own completion, so its measured duration is
      // meaningless and the warning still fires. A *different* stage
      // starting while this one is open is the unit-major case Finding 1
      // fixes — it must NOT reach this branch, and it doesn't: it simply
      // adds a new key below.
      if (openRuns.has(event.stage)) {
        warnings.push(`stage run abandoned without completion: ${event.stage}`);
        openRuns.delete(event.stage); // re-set below so it becomes "most recently opened"
      }
      openRuns.set(event.stage, {
        stage: event.stage,
        startedAt: event.timestamp,
        startMs: at,
        prevMs: at,
        activeMs: 0,
        eventCount: 0,
      });
      continue;
    }

    // Finding 2: STAGE_SKIPPED is terminal for that stage's run, the same
    // way STAGE_COMPLETED is — stage-protocol.md's conditional-skip section
    // is explicit that the engine "starts the next in-scope stage ... without
    // emitting STAGE_COMPLETED". Left alone, a skipped-while-active stage's
    // run would stay `endedAt: null` forever; on the final in-scope stage
    // that means an open run survives past workflow completion, and
    // /api/timings' consumers (the dashboard's open-run poll) never see it
    // close.
    //
    // DISCARD, don't close: a skipped stage did no work, so it has no
    // duration worth reporting, and — the sharper reason — estimate.ts's
    // sample pool is keyed on nothing but `endedAt !== null`. Closing this
    // run (even at `activeMs: 0`) would still enter the pool as a same-stage
    // sample; a real run that's merely fast is legitimate signal, but a
    // skipped run is not evidence of "how long this stage takes" and must
    // never be mistaken for one. Discarding — no `timings` entry at all —
    // is the only shape that can't be misread as a sample.
    if (event.event === "STAGE_SKIPPED") {
      if (event.stage === null) {
        warnings.push(`STAGE_SKIPPED with no Stage field at ${event.timestamp}`);
        continue;
      }
      if (openRuns.has(event.stage)) {
        openRuns.delete(event.stage);
      } else {
        warnings.push(`STAGE_SKIPPED with no open run: ${event.stage}`);
      }
      continue;
    }

    if (event.event === "STAGE_COMPLETED") {
      const completedStage = event.stage;
      const target = completedStage !== null ? openRuns.get(completedStage) : undefined;
      if (target === undefined) {
        // Codex round 7, finding 1: doesn't match any currently-open run —
        // either it names a stage that isn't open yet (the cross-shard skew
        // case: its own STAGE_STARTED hasn't sorted in ahead of it), or it
        // carries no stage at all. This must be recorded into
        // `pendingCompletions` unconditionally — NOT only when
        // `openRuns.size === 0` as before. Gating it behind an empty
        // `openRuns` meant a concurrent design stage staying open for its
        // own late cascade gate silently swallowed every OTHER stage's
        // cross-shard completion as generic "activity" on whatever was
        // open; that stage's later STAGE_STARTED then had nothing to
        // recover against and stayed open forever, corrupting both its own
        // elapsed time and the estimate pool.
        //
        // Deliberately NOT also billed as activity on the most-recently-
        // opened run (the old behaviour, removed here). A STAGE_COMPLETED
        // that names a stage is evidence of work on THAT stage — not on
        // whichever run happens to still be open — so crediting it here
        // would double-count once it later recovers into its own
        // (typically zero-duration) run via Part 2 above: the same instant
        // would be claimed by both the recovered run and the run it got
        // misattributed to. If it never recovers, it is an orphan with no
        // reliable activity signal to attach anywhere, not free activity
        // for whatever is open.
        if (completedStage === null) {
          warnings.push(`STAGE_COMPLETED without STAGE_STARTED: ${completedStage}`);
        } else {
          // Only recover when unambiguous: at most one pending completion
          // per stage. A second one bumps the first rather than stacking —
          // keep the newest, warn about the one it replaces.
          if (pendingCompletions.has(completedStage)) {
            warnings.push(
              `STAGE_COMPLETED without STAGE_STARTED: ${completedStage} (superseded by a later STAGE_COMPLETED for the same stage before either found a start)`,
            );
          }
          pendingCompletions.set(completedStage, { event, at });
        }
        continue;
      }
      applyGap(target, at);
      timings.push({
        stage: target.stage,
        startedAt: target.startedAt,
        endedAt: event.timestamp,
        wallMs: at - target.startMs,
        activeMs: target.activeMs,
        eventCount: target.eventCount,
      });
      // Safe: `target` is only defined when `completedStage !== null` found
      // a match in `openRuns` above.
      openRuns.delete(completedStage as string);
      continue;
    }

    // Any other event (ARTIFACT_CREATED, sensor events, ...): credit the run
    // it names, or — the common case, since only lifecycle events carry a
    // `Stage` field — the most recently opened run. See the attribution-rule
    // comment above `openRuns`.
    const target = event.stage !== null ? openRuns.get(event.stage) : undefined;
    const attributeTo = target ?? mostRecentlyOpened();
    if (attributeTo !== undefined) applyGap(attributeTo, at);
  }

  // Any completion still pending at the end never found a same-stage start
  // at or after it — a genuine orphan, not a reversed pair. Same warning
  // text the direct (non-recoverable) path below uses, so both routes to
  // "this completion never paired" read identically.
  for (const pending of pendingCompletions.values()) {
    warnings.push(`STAGE_COMPLETED without STAGE_STARTED: ${pending.event.stage}`);
  }

  // Finding 1: zero, one, or several runs can still be open at `now` (the
  // unit-major cascade hasn't reached this stage's gate yet). Each gets the
  // same tail treatment the single-run case always did, independently —
  // there is no shared "the" open run to special-case.
  for (const openRun of openRuns.values()) {
    // The reader's clock and the writer's clock are not the same clock; a
    // negative elapsed is skew, not a negative duration.
    if (now < openRun.startMs) {
      warnings.push(`clock skew: run ${openRun.stage} starts after now, wallMs clamped to 0`);
    }
    // The tail: from the last event to `now`, under the same idle cap the loop
    // applies between events. Without this, an open run's activeMs freezes at
    // whatever it was after the last audit event — a stage generating silently
    // for twenty minutes would show a stuck elapsed time until the next event
    // lands. `Math.max(0, …)` guards the same clock-skew case as `wallMs` above.
    const finalGapMs = Math.max(0, now - openRun.prevMs);
    const wallMs = Math.max(0, now - openRun.startMs);
    // Skew can also land entirely between two real events (the writer's clock
    // ahead of the reader's), which the per-gap `now - prevMs` clamp above
    // does not touch — those gaps are between two writer timestamps, not
    // against `now`. Re-clamping the total to `wallMs` here catches that case
    // without having to special-case it in the loop. A closed run needs no
    // equivalent: both its wallMs and activeMs derive solely from the run's
    // own event timestamps, never from `now`, so activeMs <= wallMs already
    // holds there by construction (each gap is non-negative and capped).
    const activeMs = Math.min(openRun.activeMs + Math.min(finalGapMs, IDLE_THRESHOLD_MS), wallMs);
    timings.push({
      stage: openRun.stage,
      startedAt: openRun.startedAt,
      endedAt: null,
      wallMs,
      activeMs,
      eventCount: openRun.eventCount,
    });
  }

  return { timings, warnings };
}
