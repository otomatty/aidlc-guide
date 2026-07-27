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

export function deriveStageTimings(
  events: readonly AuditEvent[],
  now: number,
): { timings: StageTiming[]; warnings: string[] } {
  const timings: StageTiming[] = [];
  const warnings: string[] = [];
  let open: OpenRun | null = null;

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
      if (open !== null) warnings.push(`stage run abandoned without completion: ${open.stage}`);
      open = {
        stage: event.stage,
        startedAt: event.timestamp,
        startMs: at,
        prevMs: at,
        activeMs: 0,
        eventCount: 0,
      };
      continue;
    }

    if (open === null) {
      if (event.event === "STAGE_COMPLETED") {
        warnings.push(`STAGE_COMPLETED without STAGE_STARTED: ${event.stage}`);
      }
      continue;
    }

    open.activeMs += Math.min(at - open.prevMs, IDLE_THRESHOLD_MS);
    open.prevMs = at;
    open.eventCount += 1;

    if (event.event === "STAGE_COMPLETED") {
      if (event.stage !== open.stage) {
        warnings.push(`STAGE_COMPLETED for ${event.stage} while ${open.stage} was open`);
        continue;
      }
      timings.push({
        stage: open.stage,
        startedAt: open.startedAt,
        endedAt: event.timestamp,
        wallMs: at - open.startMs,
        activeMs: open.activeMs,
        eventCount: open.eventCount,
      });
      open = null;
    }
  }

  if (open !== null) {
    // The reader's clock and the writer's clock are not the same clock; a
    // negative elapsed is skew, not a negative duration.
    if (now < open.startMs) {
      warnings.push(`clock skew: run ${open.stage} starts after now, wallMs clamped to 0`);
    }
    // The tail: from the last event to `now`, under the same idle cap the loop
    // applies between events. Without this, an open run's activeMs freezes at
    // whatever it was after the last audit event — a stage generating silently
    // for twenty minutes would show a stuck elapsed time until the next event
    // lands. `Math.max(0, …)` guards the same clock-skew case as `wallMs` above.
    const finalGapMs = Math.max(0, now - open.prevMs);
    const wallMs = Math.max(0, now - open.startMs);
    // Skew can also land entirely between two real events (the writer's clock
    // ahead of the reader's), which the per-gap `now - prevMs` clamp above
    // does not touch — those gaps are between two writer timestamps, not
    // against `now`. Re-clamping the total to `wallMs` here catches that case
    // without having to special-case it in the loop. A closed run needs no
    // equivalent: both its wallMs and activeMs derive solely from the run's
    // own event timestamps, never from `now`, so activeMs <= wallMs already
    // holds there by construction (each gap is non-negative and capped).
    const activeMs = Math.min(open.activeMs + Math.min(finalGapMs, IDLE_THRESHOLD_MS), wallMs);
    timings.push({
      stage: open.stage,
      startedAt: open.startedAt,
      endedAt: null,
      wallMs,
      activeMs,
      eventCount: open.eventCount,
    });
  }

  return { timings, warnings };
}
