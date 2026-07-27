import type { AuditEvent, StageTiming } from "@aidlc-guide/shared-types";

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
 * Ascending by parsed time, shard name as the tiebreak.
 *
 * `Array.prototype.sort` is stable, so records sharing a timestamp *and* a
 * shard keep append order — which matters: the engine stamps a stage's
 * STAGE_COMPLETED and the next stage's STAGE_STARTED with the same second, and
 * only append order says which came first.
 *
 * This relies on `../audit/events.ts` tie-breaking on the same pairs of equal
 * timestamps as this comparator does — but `events.ts` compares timestamps by
 * string equality while this one compares by numeric `Date.parse` difference,
 * so they only agree today because every timestamp in the record is exactly
 * `YYYY-MM-DDTHH:MM:SSZ`; an offset or millisecond form would make the two
 * comparators disagree on which events tie, silently reordering same-second
 * STARTED/COMPLETED pairs.
 */
function ascending(a: AuditEvent, b: AuditEvent): number {
  const delta = Date.parse(a.timestamp) - Date.parse(b.timestamp);
  return delta !== 0 ? delta : a.shard.localeCompare(b.shard);
}

export function deriveStageTimings(
  events: readonly AuditEvent[],
  now: number,
): { timings: StageTiming[]; warnings: string[] } {
  const timings: StageTiming[] = [];
  const warnings: string[] = [];
  let open: OpenRun | null = null;

  for (const event of [...events].sort(ascending)) {
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
    timings.push({
      stage: open.stage,
      startedAt: open.startedAt,
      endedAt: null,
      wallMs: Math.max(0, now - open.startMs),
      activeMs: open.activeMs,
      eventCount: open.eventCount,
    });
  }

  return { timings, warnings };
}
