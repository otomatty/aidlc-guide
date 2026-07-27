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

/**
 * Codex round 11, finding 3: this used to be `PendingCompletion`, holding
 * only STAGE_COMPLETEDs that arrived with no matching open run. STAGE_SKIPPED
 * is terminal for a run the same way STAGE_COMPLETED is (see the STAGE_SKIPPED
 * handling below), so it can strand a run open forever the exact same way —
 * a skip that sorts before its own start (cross-shard clock skew) used to
 * only warn and leave the eventual STAGE_STARTED to open a run nothing ever
 * closes. `kind` lets the shared bounded skew-recovery path in the
 * STAGE_STARTED handler give a recovered skip the discard-don't-close
 * treatment real STAGE_SKIPPEDs get, instead of the zero-duration-run
 * treatment recovered completions get — and lets the two stay
 * distinguishable in the warning text a reader sees.
 */
interface PendingTerminal {
  event: AuditEvent;
  at: number;
  kind: "completed" | "skipped";
}

/**
 * Codex round 11, finding 1: there used to be a `comparePairAware` wrapper
 * here that forced STAGE_STARTED before STAGE_COMPLETED whenever two events
 * named the same stage and shared a timestamp — added to fix a cross-shard
 * tie (this log has second resolution) where the shard-name tiebreak could
 * sort a stage's own completion ahead of its start, stranding the start open
 * forever.
 *
 * That rule is gone. It shared its trigger (same stage, same second, one
 * STARTED and one COMPLETED) with a case it broke: a rerun whose closing
 * COMPLETED and reopening STARTED land in the same second (a rapid backward
 * jump plus this log's second resolution). A pure comparator cannot tell
 * "cross-shard tie" from "real rerun boundary" apart — the distinction is run
 * *state*, not event content — so forcing STARTED-first unconditionally
 * reordered the rerun's real boundary too, collapsing two genuine attempts
 * into one abandoned run plus one orphaned completion.
 *
 * The cross-shard tie does not need a comparator rule: with plain
 * `compareByTime`, the completion sorts first, finds no open run, and lands
 * in `pendingTerminals` below; the same-second (or later, within
 * `IDLE_THRESHOLD_MS`) STAGE_STARTED then recovers it via the bounded skew
 * recovery a few lines down (`at >= pending.at` holds on a tie). That is
 * already the correct place for "these two events are the same lifecycle
 * pair, just clock-disordered" to be resolved — it is what the recovery
 * exists for. The rerun boundary needs no help at all: with the comparator
 * rule gone, `compareByTime`'s stable tiebreak preserves append order for a
 * same-shard tie, so COMPLETED-then-STARTED still sorts COMPLETED first,
 * closing attempt 1 before attempt 2 opens.
 */

/**
 * Advances `run`'s own gap cursor to `at`, crediting the capped gap as
 * active time and counting this event towards it. Only ever called on the
 * run an event is attributed to — see `advanceCursors` below for how every
 * OTHER open run's cursor stays current without accruing anything.
 */
function applyGap(run: OpenRun, at: number): void {
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
 * (unit-major's cascading gates — see the `openRuns` comment below) had its
 * `prevMs` frozen at whatever event it last received. The next time it WAS
 * attributed — typically its own STAGE_COMPLETED — `applyGap` computed the
 * gap against that stale cursor, so the entire stretch during which the
 * OTHER stage was actually being worked got billed to this run too. Same
 * wall-clock minutes, charged to two runs' `activeMs` at once.
 *
 * With every open run's cursor kept current, a run only ever accrues the
 * span between two events for which IT was the target — never a span some
 * other run was the target for. At most one run is `target` per event, so
 * for any given inter-event interval either exactly one run bills it (via
 * `applyGap`) or none do; no interval is ever billed twice. Since each
 * run's own capped, non-negative gaps still sum to no more than its own
 * wallMs (unchanged from before), that "at most one biller per interval"
 * property is exactly what keeps the SUM of several open runs' activeMs
 * bounded by the wall time of the span they jointly cover.
 */
function advanceCursors(
  openRuns: Map<string, OpenRun>,
  at: number,
  target: OpenRun | undefined,
): void {
  for (const run of openRuns.values()) {
    if (run === target) {
      applyGap(run, at);
    } else {
      run.prevMs = at;
    }
  }
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
  // real work is currently landing against.
  //
  // Codex round 7, finding 2: naming one target per event is necessary but
  // was not sufficient — see `advanceCursors` above. Every open run's
  // `prevMs` cursor is advanced on EVERY event regardless of which run (if
  // any) is the target; only the target's `activeMs` grows. That is what
  // keeps a run that stopped being the target from later being billed, via
  // a stale cursor, for wall time a DIFFERENT run was already credited for.
  const openRuns = new Map<string, OpenRun>();
  // STAGE_COMPLETEDs and STAGE_SKIPPEDs that found no matching open run for
  // their own stage (whether or not OTHER stages are open — see the
  // finding-1 comment on the STAGE_COMPLETED handling below), keyed by
  // stage, waiting to see whether a same-stage STAGE_STARTED shows up after
  // them — the clock-skew reversal case Part 2 recovers. A `null`-stage
  // terminal event can't be keyed this way and falls back to the plain
  // unmatched warning immediately.
  const pendingTerminals = new Map<string, PendingTerminal>();

  /** Last-inserted (= most recently opened) entry still in `openRuns`. */
  function mostRecentlyOpened(): OpenRun | undefined {
    let last: OpenRun | undefined;
    for (const run of openRuns.values()) last = run;
    return last;
  }

  // Codex round 11, finding 2: the run the tail (last event → `now`) is
  // billed to. Tracks the run that was actually last credited via
  // `applyGap`, NOT `mostRecentlyOpened()` — during unit-major's late gate
  // cascade a stage-keyed event can target an EARLIER-opened stage while a
  // later-opened one sits idle waiting on its own gate; `mostRecentlyOpened()`
  // would then hand the tail to the idle stage just because it opened later,
  // never having done any of the work. Updated at every point this file
  // actually bills a run (mirrors, rather than recomputes, the loop's own
  // attribution decisions) and consumed only at the very end, guarded by an
  // "is this run still open" check in case the last-attributed run has since
  // closed (see the tail computation below).
  let lastAttributed: OpenRun | undefined;

  for (const event of [...events].sort(compareByTime)) {
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

      // Part 2: a terminal event (STAGE_COMPLETED or, since Codex round 11
      // finding 3, STAGE_SKIPPED) for this exact stage already arrived with
      // no run open, and this start lands at or after it — a pairing broken
      // by the two events landing in different shards with disagreeing
      // clocks. Recover it instead of opening a run that will now never see
      // its (already-consumed) terminal event and stay open forever.
      //
      // Bounded to IDLE_THRESHOLD_MS: unbounded, this "recovery" hijacks an
      // unrelated LEGITIMATE rerun. If a prior attempt's STAGE_STARTED is
      // missing or malformed while its terminal event survives, that event
      // sits in `pendingTerminals` indefinitely; when the same stage is
      // genuinely re-run hours or days later, this branch would consume that
      // new, real start as the old terminal event's "reversed pair",
      // recording a spurious result that never opens — and its own real
      // terminal event becomes the next orphan. Clock disagreement between
      // clones is a small-magnitude effect (seconds, not minutes); reusing
      // IDLE_THRESHOLD_MS (10 minutes — this file's existing definition of "a
      // gap this large means something else is going on", see above) gives
      // clock skew generous headroom while staying far below the gap a real
      // rerun leaves. Beyond the window, the terminal event is left in
      // `pendingTerminals` as the genuine orphan it is (it still surfaces its
      // unmatched-terminal warning at the end of the loop) and this start
      // falls through to open an ordinary new run below.
      const pending = pendingTerminals.get(event.stage);
      if (pending !== undefined && at >= pending.at && at - pending.at <= IDLE_THRESHOLD_MS) {
        pendingTerminals.delete(event.stage);
        // Nobody is billed for this event (whatever is recovered here is
        // synthetic) but time still passed for whatever else is open — keep
        // their cursors current (finding 2).
        advanceCursors(openRuns, at, undefined);
        if (pending.kind === "completed") {
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
        } else {
          // A recovered skip gets the same DISCARD treatment an ordinary
          // STAGE_SKIPPED gets below — no `timings` entry, so it can never be
          // mistaken for a sample in estimate.ts's pool. Distinct wording
          // from the completed case so a reader can tell "this pair was a
          // skip" from "this pair was a completion" — the whole point of
          // carrying `kind` through instead of collapsing both into one
          // generic "recovered" message.
          warnings.push(
            `clock skew: STAGE_SKIPPED for ${event.stage} was recorded before its STAGE_STARTED (shards disagree on the clock) — discarded, no run recorded`,
          );
        }
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
      // A STAGE_STARTED never bills anyone itself — it marks work moving
      // onto a brand-new run, not activity on an existing one — but every
      // run left open through it still needs its cursor caught up
      // (finding 2), or a later gap on one of them would silently span the
      // whole time this new stage was the real attribution target.
      advanceCursors(openRuns, at, undefined);
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
      // A skip bills nobody (the skipped run itself is about to be
      // discarded, not billed) but it is still a point in time — whatever
      // else stays open must have its cursor caught up (finding 2).
      advanceCursors(openRuns, at, undefined);
      if (openRuns.has(event.stage)) {
        openRuns.delete(event.stage);
      } else {
        // Codex round 11, finding 3: this used to warn immediately and stop
        // there, leaving a same-stage STAGE_STARTED that arrives later (the
        // cross-shard skew case — the skip sorted before its own start) with
        // nothing telling it the stage was already skipped, so it opened a
        // run nothing would ever close. Route it through the same bounded
        // pending/recovery mechanism unmatched STAGE_COMPLETEDs already use
        // (Part 2 of the STAGE_STARTED handler above) instead of a parallel
        // one: if a same-stage start shows up within IDLE_THRESHOLD_MS, it
        // recovers this as a discarded (not zero-duration-closed) run; if
        // not, this exact warning still fires at the end of the loop as the
        // genuine orphan it is.
        if (pendingTerminals.has(event.stage)) {
          warnings.push(
            `STAGE_SKIPPED with no open run: ${event.stage} (superseded by a later terminal event for the same stage before either found a start)`,
          );
        }
        pendingTerminals.set(event.stage, { event, at, kind: "skipped" });
      }
      continue;
    }

    if (event.event === "STAGE_COMPLETED") {
      const completedStage = event.stage;
      const target = completedStage !== null ? openRuns.get(completedStage) : undefined;
      if (target === undefined) {
        // Finding 1 (Codex round 7): doesn't match any currently-open run —
        // either it names a stage that isn't open yet (the cross-shard skew
        // case: its own STAGE_STARTED hasn't sorted in ahead of it), or it
        // carries no stage at all. This must be recorded into
        // `pendingTerminals` unconditionally — NOT only when
        // `openRuns.size === 0` as before. Gating it behind an empty
        // `openRuns` meant a concurrent design stage staying open for its
        // own late cascade gate silently swallowed every OTHER stage's
        // cross-shard completion as generic "activity"; that stage's later
        // STAGE_STARTED then had nothing to recover against and stayed
        // open forever, corrupting both its own elapsed time and the
        // estimate pool.
        //
        // Deliberately NOT also billed as activity on the most-recently-
        // opened run (contrast the "any other event" path below, which
        // does bill it). A STAGE_COMPLETED that names a stage is evidence
        // of work on THAT stage — not on whichever run happens to still be
        // open — so crediting it here would double-count once it later
        // recovers into its own (typically zero-duration) run via Part 2
        // above: the same instant would be claimed by both the recovered
        // run and the run it got misattributed to. If it never recovers,
        // it is an orphan with no reliable activity signal to attach
        // anywhere, not free activity for whatever is open.
        //
        // Cursors of whatever IS open still advance (finding 2) — this
        // event is a point in time even though nobody is billed for it.
        advanceCursors(openRuns, at, undefined);
        if (completedStage === null) {
          warnings.push(`STAGE_COMPLETED without STAGE_STARTED: ${completedStage}`);
        } else {
          // Only recover when unambiguous: at most one pending terminal event
          // per stage. A second one bumps the first rather than stacking —
          // keep the newest, warn about the one it replaces.
          if (pendingTerminals.has(completedStage)) {
            warnings.push(
              `STAGE_COMPLETED without STAGE_STARTED: ${completedStage} (superseded by a later STAGE_COMPLETED for the same stage before either found a start)`,
            );
          }
          pendingTerminals.set(completedStage, { event, at, kind: "completed" });
        }
        continue;
      }
      advanceCursors(openRuns, at, target);
      lastAttributed = target;
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
    //
    // Codex round 10: the fallback to `mostRecentlyOpened()` must fire ONLY
    // when the event names no stage at all (`event.stage === null`) — NOT
    // whenever `openRuns.get(event.stage)` comes back empty. stage-protocol.md
    // (unit-major iteration) states a stage's own STAGE_STARTED can legally
    // land AFTER that stage's per-Unit artifact events, so a stage-keyed event
    // with no open run yet is expected, not an anomaly. Falling back to
    // `mostRecentlyOpened()` for it would charge the interval to a DIFFERENT,
    // earlier stage that's merely still open for its own late cascade gate —
    // stealing both activeMs and eventCount from the stage that actually did
    // the work. There is no run to correctly bill this event to yet, so it is
    // left unattributed: `advanceCursors` still moves every open run's cursor
    // past it (nobody banks the interval for later), but nobody's activeMs or
    // eventCount grows. This mirrors the mismatched-STAGE_COMPLETED branch
    // above, which already leaves an unmatched completion unbilled rather than
    // crediting `mostRecentlyOpened()`.
    const attributeTo = event.stage !== null ? openRuns.get(event.stage) : mostRecentlyOpened();
    advanceCursors(openRuns, at, attributeTo);
    if (attributeTo !== undefined) lastAttributed = attributeTo;
  }

  // Any terminal event still pending at the end never found a same-stage
  // start at or after it — a genuine orphan, not a reversed pair. Same
  // warning text each direct (non-recoverable) path above uses, so every
  // route to "this terminal event never paired" reads identically.
  for (const pending of pendingTerminals.values()) {
    warnings.push(
      pending.kind === "completed"
        ? `STAGE_COMPLETED without STAGE_STARTED: ${pending.event.stage}`
        : `STAGE_SKIPPED with no open run: ${pending.event.stage}`,
    );
  }

  // Finding 1: zero, one, or several runs can still be open at `now` (the
  // unit-major cascade hasn't reached this stage's gate yet). Each gets the
  // same tail treatment the single-run case always did, independently —
  // there is no shared "the" open run to special-case.
  //
  // Codex round 9, finding 1: "each" does NOT mean "every open run bills the
  // tail". The tail (last event → `now`) is one span of wall time, and per
  // the attribution rule this whole file follows, at most one run is ever
  // the real target for a span with no event naming a different one.
  // Crediting the tail to EVERY open run — the previous behaviour — billed
  // the same wall-clock minutes to two or more runs at once, the
  // loop-internal version of this bug that `advanceCursors` above already
  // fixed for in-loop gaps.
  //
  // Codex round 11, finding 2: that "one real target" is `lastAttributed`,
  // NOT `mostRecentlyOpened()`. During unit-major's late gate cascade a
  // stage-keyed event can target an EARLIER-opened run while a LATER-opened
  // one just sits open waiting on its own gate; `mostRecentlyOpened()` would
  // then hand a silent tail to the idle, later-opened stage purely because
  // it opened later, never having received a single event. `lastAttributed`
  // mirrors the loop's own in-progress attribution decisions instead of
  // recomputing a different (and, in this shape, wrong) notion of "current".
  // Guarded by an identity check against `openRuns`, not just presence: if
  // the last-attributed run has SINCE closed (its own STAGE_COMPLETED came
  // after the last event that attributed to it) — or, more precisely, isn't
  // the run currently occupying that stage's slot — there is no still-open
  // run that was ever actually credited, so this falls back to the original
  // `mostRecentlyOpened()` behaviour, same as when nothing has been
  // attributed yet at all (`lastAttributed` still `undefined`).
  const tailTarget =
    lastAttributed !== undefined && openRuns.get(lastAttributed.stage) === lastAttributed
      ? lastAttributed
      : mostRecentlyOpened();
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
    // lands. `Math.max(0, …)` guards the same clock-skew case as `wallMs`
    // below. Only `tailTarget` accrues it — every other open run gets 0 here,
    // exactly like `advanceCursors`' non-target branch: its `activeMs` is
    // already correctly scoped to spans where IT was the target, and the
    // tail span is not one of them.
    const finalGapMs = openRun === tailTarget ? Math.max(0, now - openRun.prevMs) : 0;
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
