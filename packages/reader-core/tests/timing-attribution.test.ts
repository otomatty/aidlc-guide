import type { AuditEvent } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { attributeRuns, IDLE_THRESHOLD_MS } from "../src/timing/attribution.ts";
import type { RunBoundary } from "../src/timing/pairing.ts";

/**
 * Pass-2-only unit tests: hand-built boundaries + events, no pairing
 * involved. Mirrors what `pairRuns` would have produced for each scenario —
 * see `timing-pairing.test.ts` for proof pairing itself builds these shapes
 * correctly; this file only tests what attribution does with a given shape.
 */

const T0 = Date.parse("2026-07-20T00:00:00Z");
const at = (offsetMin: number) => T0 + offsetMin * 60_000;
const iso = (offsetMin: number) => new Date(at(offsetMin)).toISOString();

function event(kind: string, stage: string | null, offsetMin: number): AuditEvent {
  return { event: kind, stage, timestamp: iso(offsetMin), shard: "a.md", workflow: null };
}

function boundary(
  stage: string,
  openIndex: number | null,
  closeIndex: number | null,
  disposition: RunBoundary["disposition"],
  offsets: { start: number; end?: number },
): RunBoundary {
  return {
    stage,
    startedAt: iso(offsets.start),
    startMs: at(offsets.start),
    openIndex,
    closeIndex,
    endedAt: offsets.end !== undefined ? iso(offsets.end) : null,
    disposition,
  };
}

describe("attributeRuns", () => {
  it("bills a lone open-to-close run every gap in between, one target per interval", () => {
    const events = [
      event("STAGE_STARTED", "a", 0),
      event("ARTIFACT_CREATED", null, 3),
      event("STAGE_COMPLETED", "a", 5),
    ];
    const b = boundary("a", 0, 2, "completed", { start: 0, end: 5 });
    const { results, warnings } = attributeRuns(events, [b], at(60));
    expect(warnings).toEqual([]);
    expect(results.get(b)).toEqual({ wallMs: 5 * 60_000, activeMs: 5 * 60_000, eventCount: 2 });
  });

  it("splits concurrent open runs so the sum of activeMs over a shared span never exceeds that span's wall time", () => {
    // a opens, b opens while a stays open, one stage-null event lands (goes
    // to the most-recently-opened, b), both close.
    const events = [
      event("STAGE_STARTED", "a", 0),
      event("STAGE_STARTED", "b", 1),
      event("ARTIFACT_CREATED", null, 4),
      event("STAGE_COMPLETED", "b", 6),
      event("STAGE_COMPLETED", "a", 8),
    ];
    const a = boundary("a", 0, 4, "completed", { start: 0, end: 8 });
    const b = boundary("b", 1, 3, "completed", { start: 1, end: 6 });
    const { results, warnings } = attributeRuns(events, [a, b], at(60));
    expect(warnings).toEqual([]);
    const ra = results.get(a);
    const rb = results.get(b);
    expect(ra).toMatchObject({ activeMs: 2 * 60_000 }); // only the +6m..+8m tail-of-loop gap
    expect(rb).toMatchObject({ activeMs: 5 * 60_000 }); // +1m..+4m and +4m..+6m
    expect((ra?.activeMs ?? 0) + (rb?.activeMs ?? 0)).toBeLessThanOrEqual(8 * 60_000);
  });

  it("caps a gap at IDLE_THRESHOLD_MS instead of billing the full silence", () => {
    const events = [event("STAGE_STARTED", "a", 0), event("STAGE_COMPLETED", "a", 30)];
    const b = boundary("a", 0, 1, "completed", { start: 0, end: 30 });
    const { results } = attributeRuns(events, [b], at(60));
    expect(results.get(b)).toMatchObject({ activeMs: IDLE_THRESHOLD_MS, wallMs: 30 * 60_000 });
  });

  it("caps the tail the same way, and gives it only to the last-attributed run", () => {
    const events = [
      event("STAGE_STARTED", "a", 0),
      event("STAGE_STARTED", "b", 1),
      event("ARTIFACT_CREATED", "a", 2),
    ];
    const a = boundary("a", 0, null, "open", { start: 0 });
    const b = boundary("b", 1, null, "open", { start: 1 });
    const { results, warnings } = attributeRuns(events, [a, b], at(7));
    expect(warnings).toEqual([]);
    // a's cursor was caught up (not billed) to +1m when b opened, so the +2m
    // event only bills the +1m..+2m gap (1m); the tail then adds +2m..+7m
    // (5m) since a was the run last actually attributed. b never received an
    // event and gets no tail at all.
    expect(results.get(a)).toMatchObject({ wallMs: 7 * 60_000, activeMs: 6 * 60_000 });
    expect(results.get(b)).toMatchObject({ wallMs: 6 * 60_000, activeMs: 0 });
  });

  it("gives the tail to the most recently opened run when nothing was ever attributed", () => {
    const events = [event("STAGE_STARTED", "a", 0), event("STAGE_STARTED", "b", 1)];
    const a = boundary("a", 0, null, "open", { start: 0 });
    const b = boundary("b", 1, null, "open", { start: 1 });
    const { results } = attributeRuns(events, [a, b], at(7));
    expect(results.get(a)).toMatchObject({ activeMs: 0 });
    expect(results.get(b)).toMatchObject({ activeMs: 6 * 60_000 }); // +1m..+7m tail
  });

  it("clamps activeMs to wallMs when the writer's clock is ahead of the reader's, and warns", () => {
    const events = [event("STAGE_STARTED", "a", 10), event("ARTIFACT_CREATED", null, 15)];
    const b = boundary("a", 0, null, "open", { start: 10 });
    const { results, warnings } = attributeRuns(events, [b], T0);
    expect(warnings).toEqual(["clock skew: run a starts after now, wallMs clamped to 0"]);
    const r = results.get(b);
    expect(r?.wallMs).toBe(0);
    expect(r?.activeMs).toBe(0);
    expect(r?.activeMs).toBeLessThanOrEqual(r?.wallMs as number);
  });

  it("lets abandoned/skipped boundaries soak up the events that landed while they were open, without ever being reported", () => {
    // f opens (index 0), n opens while f stays open (index 1), an event
    // lands stage-keyed to f (index 2) — must land on f's FIRST attempt, not
    // leak to n — then f double-starts, abandoning attempt 1 (index 3), and
    // both eventually close.
    const events = [
      event("STAGE_STARTED", "f", 0),
      event("STAGE_STARTED", "n", 1),
      event("ARTIFACT_CREATED", "f", 2),
      event("STAGE_STARTED", "f", 3), // abandons attempt 1
      event("STAGE_COMPLETED", "n", 5),
      event("STAGE_COMPLETED", "f", 7),
    ];
    const fFirst = boundary("f", 0, 3, "abandoned", { start: 0 });
    const n = boundary("n", 1, 4, "completed", { start: 1, end: 5 });
    const fSecond = boundary("f", 3, 5, "completed", { start: 3, end: 7 });
    const { results, warnings } = attributeRuns(events, [fFirst, n, fSecond], at(10));
    expect(warnings).toEqual([]);
    // f's first (abandoned) attempt's cursor was already caught up (not
    // billed) to +1m when n opened, so its own event at +2m bills only the
    // +1m..+2m gap (1m) — never reported, but the number must exist and be
    // sane (Codex round 7 finding 2's "every open run's cursor advances on
    // every event" rule applies to a soon-to-be-discarded run too).
    expect(results.get(fFirst)).toMatchObject({ activeMs: 1 * 60_000 });
    // n's cursor is likewise caught up (not billed) by f's +2m event and by
    // f's own double-start at +3m — neither of which named "n" — so n only
    // bills its own +3m..+5m completion gap (2m), not the full +1m..+5m span.
    expect(results.get(n)).toMatchObject({ activeMs: 2 * 60_000 });
    // f's second attempt: opened at +3m, its cursor caught up (not billed)
    // again by n's completion at +5m, so it bills only the +5m..+7m gap (2m).
    expect(results.get(fSecond)).toMatchObject({ activeMs: 2 * 60_000 });
  });

  it("never opens a recovered-completed/recovered-skipped boundary — zero attribution and a wallMs clamped against reversed timestamps", () => {
    const recoveredCompleted = boundary("alpha", null, 1, "recovered-completed", {
      start: 5,
      end: 0,
    });
    const recoveredSkipped = boundary("beta", null, 1, "recovered-skipped", { start: 5, end: 0 });
    const events = [event("STAGE_STARTED", "alpha", 5)];
    const { results } = attributeRuns(events, [recoveredCompleted, recoveredSkipped], at(10));
    expect(results.get(recoveredCompleted)).toEqual({ wallMs: 0, activeMs: 0, eventCount: 0 });
    expect(results.get(recoveredSkipped)).toEqual({ wallMs: 0, activeMs: 0, eventCount: 0 });
  });

  it("attributes a stage-named event with no open run to nobody, not to mostRecentlyOpened", () => {
    // b's boundary opens at index 3; the event at index 1 names "b" but
    // arrives before b's own open — it must be unattributed, not billed to
    // whichever run happens to be open at that point (a).
    const events = [
      event("STAGE_STARTED", "a", 0),
      event("ARTIFACT_CREATED", "b", 2),
      event("STAGE_STARTED", "b", 4),
      event("STAGE_COMPLETED", "b", 6),
      event("STAGE_COMPLETED", "a", 8),
    ];
    const a = boundary("a", 0, 4, "completed", { start: 0, end: 8 });
    const b = boundary("b", 2, 3, "completed", { start: 4, end: 6 });
    const { results } = attributeRuns(events, [a, b], at(10));
    // a only bills the +6m..+8m tail after b closes (2m) — not the +2m
    // pre-start artifact event named for b.
    expect(results.get(a)).toMatchObject({ activeMs: 2 * 60_000, eventCount: 1 });
    expect(results.get(b)).toMatchObject({ activeMs: 2 * 60_000, eventCount: 1 });
  });
});
