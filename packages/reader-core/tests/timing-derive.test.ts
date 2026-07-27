import type { AuditEvent } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { readAllAuditEvents } from "../src/audit/events.ts";
import { deriveStageTimings, IDLE_THRESHOLD_MS } from "../src/timing/derive.ts";
import { expectOk, REAL_RECORD } from "./paths.ts";

const T0 = Date.parse("2026-07-20T00:00:00Z");

/** Newest-first, like readAllAuditEvents — derive must sort for itself. */
function events(
  ...rows: Array<[event: string, stage: string | null, offsetMin: number, workflow?: string | null]>
) {
  return rows
    .map(([event, stage, offsetMin, workflow]) => ({
      event,
      stage,
      timestamp: new Date(T0 + offsetMin * 60_000).toISOString(),
      shard: "a.md",
      workflow: workflow ?? null,
    }))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)) satisfies AuditEvent[];
}

const NOW = T0 + 60 * 60_000;

describe("deriveStageTimings", () => {
  it("pairs a start with its completion", () => {
    const { timings, warnings } = deriveStageTimings(
      events(
        ["STAGE_STARTED", "alpha", 0],
        ["ARTIFACT_CREATED", null, 3],
        ["STAGE_COMPLETED", "alpha", 5],
      ),
      NOW,
    );
    expect(warnings).toEqual([]);
    expect(timings).toEqual([
      {
        stage: "alpha",
        startedAt: "2026-07-20T00:00:00.000Z",
        endedAt: "2026-07-20T00:05:00.000Z",
        wallMs: 5 * 60_000,
        activeMs: 5 * 60_000,
        eventCount: 2,
      },
    ]);
  });

  it("leaves an unfinished run open and measures it against now", () => {
    const { timings } = deriveStageTimings(
      events(["STAGE_STARTED", "alpha", 0], ["ARTIFACT_CREATED", null, 4]),
      NOW,
    );
    expect(timings[0]?.endedAt).toBeNull();
    expect(timings[0]?.wallMs).toBe(60 * 60_000);
    // The last event is at +4m; NOW is at +60m, a 56m tail. That tail is
    // active time too (the run is still open) but capped at IDLE_THRESHOLD_MS
    // like every other gap, so activeMs is the 4m already counted plus a
    // 10m-capped tail, not the 4m alone and not the full 56m.
    expect(timings[0]?.activeMs).toBe(4 * 60_000 + IDLE_THRESHOLD_MS);
    expect(timings[0]?.activeMs).toBe(14 * 60_000);
    expect(timings[0]?.activeMs).toBeLessThanOrEqual(timings[0]?.wallMs as number);
  });

  it("keeps counting an open run's elapsed time between audit events, not just at them", () => {
    // The scenario the tail-gap fix exists for: a stage that emits one event
    // and then goes silent for a long stretch of real work must not show a
    // frozen elapsed time — it should report the capped tail, not 0.
    const { timings } = deriveStageTimings(events(["STAGE_STARTED", "alpha", 0]), NOW);
    expect(timings[0]?.endedAt).toBeNull();
    expect(timings[0]?.activeMs).toBe(IDLE_THRESHOLD_MS);
    expect(timings[0]?.activeMs).toBeGreaterThan(0);
    expect(timings[0]?.activeMs).toBeLessThanOrEqual(timings[0]?.wallMs as number);
  });

  it("caps a gap at the idle threshold instead of dropping it", () => {
    const under = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 9]),
      NOW,
    );
    const exact = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 10]),
      NOW,
    );
    const over = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 30]),
      NOW,
    );
    expect(under.timings[0]?.activeMs).toBe(9 * 60_000);
    expect(exact.timings[0]?.activeMs).toBe(IDLE_THRESHOLD_MS);
    expect(over.timings[0]?.activeMs).toBe(IDLE_THRESHOLD_MS);
    expect(over.timings[0]?.wallMs).toBe(30 * 60_000);
  });

  it("reports zero active time for a run with no events after the start", () => {
    // `now` here is T0, the same instant as STAGE_STARTED itself — the tail
    // gap (now - prevMs) is 0, so this stays 0 even with the tail-gap fix.
    // (Contrast the "keeps counting" test above, where `now` is later.)
    const { timings } = deriveStageTimings(events(["STAGE_STARTED", "a", 0]), T0);
    expect(timings[0]?.activeMs).toBe(0);
    expect(timings[0]?.eventCount).toBe(0);
  });

  it("abandons a run when the same stage starts again", () => {
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_STARTED", "a", 5], ["STAGE_COMPLETED", "a", 9]),
      NOW,
    );
    expect(timings).toHaveLength(1);
    expect(timings[0]?.startedAt).toBe("2026-07-20T00:05:00.000Z");
    expect(warnings).toEqual(["stage run abandoned without completion: a"]);
  });

  it("ignores a synthetic single-stage pair interleaved inside an open main-workflow run", () => {
    // Simulates `/aidlc --stage beta --single` firing while `alpha` is the
    // real, open main-workflow run — the scenario Finding 1 describes. The
    // synthetic pair must not abandon `alpha`, must not close anything, and
    // must not contribute a `beta` run of its own.
    const { timings, warnings } = deriveStageTimings(
      [
        ...events(["STAGE_STARTED", "alpha", 0]),
        ...events(["STAGE_STARTED", "beta", 5, "single-stage:beta"]),
        ...events(["STAGE_COMPLETED", "beta", 6, "single-stage:beta"]),
        ...events(["STAGE_COMPLETED", "alpha", 10]),
      ],
      NOW,
    );
    expect(warnings).toEqual([]);
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({
      stage: "alpha",
      startedAt: "2026-07-20T00:00:00.000Z",
      endedAt: "2026-07-20T00:10:00.000Z",
      activeMs: 10 * 60_000,
      eventCount: 1,
    });
  });

  it("warns on a completion with no open run", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_COMPLETED", "a", 0]), NOW);
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["STAGE_COMPLETED without STAGE_STARTED: a"]);
  });

  it("warns when a completion names a different stage than the open run", () => {
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "b", 5], ["STAGE_COMPLETED", "a", 6]),
      NOW,
    );
    expect(timings).toHaveLength(1);
    expect(warnings).toEqual(["STAGE_COMPLETED for b while a was open"]);
    // The mismatched completion still counts as activity on the open run: it is
    // evidence the workflow was moving, even though it closes nothing.
    expect(timings[0]).toMatchObject({
      stage: "a",
      endedAt: "2026-07-20T00:06:00.000Z",
      activeMs: 6 * 60_000,
      eventCount: 2,
    });
  });

  it("skips a start with no stage name", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_STARTED", null, 0]), NOW);
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["STAGE_STARTED with no Stage field at 2026-07-20T00:00:00.000Z"]);
  });

  it("skips an unparseable timestamp", () => {
    const { timings, warnings } = deriveStageTimings(
      [
        {
          event: "STAGE_STARTED",
          stage: "a",
          timestamp: "not-a-date",
          shard: "a.md",
          workflow: null,
        },
      ],
      NOW,
    );
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["unparseable timestamp: not-a-date"]);
  });

  it("skips an unparseable timestamp mid-run without advancing the gap cursor", () => {
    const { timings, warnings } = deriveStageTimings(
      [
        ...events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 8]),
        // Where this sorts is undefined (Date.parse gives NaN), and that is the
        // point: wherever it lands it contributes nothing, so the run still
        // reads as 8 minutes with one counted event.
        {
          event: "ARTIFACT_UPDATED",
          stage: null,
          timestamp: "not-a-date",
          shard: "a.md",
          workflow: null,
        },
      ],
      NOW,
    );
    expect(warnings).toEqual(["unparseable timestamp: not-a-date"]);
    expect(timings[0]).toMatchObject({ activeMs: 8 * 60_000, eventCount: 1 });
  });

  it("keeps valid events correctly ordered around an interleaved malformed timestamp (regression: comparator NaN total order, finding 1)", () => {
    // `Date.parse` on the malformed timestamp yields NaN, and NaN comparisons
    // are always false — a comparator that returns NaN for this pair is not a
    // total order. This exact pre-sort input order ([completed, malformed,
    // started]) is a known case where the old comparator left it unchanged
    // instead of sorting it, silently placing STAGE_COMPLETED ahead of the
    // STAGE_STARTED it belongs to.
    const [completed, started] = events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "a", 5]);
    const malformed: AuditEvent = {
      event: "ARTIFACT_UPDATED",
      stage: null,
      timestamp: "not-a-date",
      shard: "a.md",
      workflow: null,
    };
    const { timings, warnings } = deriveStageTimings(
      [completed as AuditEvent, malformed, started as AuditEvent],
      NOW,
    );
    expect(warnings).toEqual(["unparseable timestamp: not-a-date"]);
    expect(timings).toEqual([
      {
        stage: "a",
        startedAt: "2026-07-20T00:00:00.000Z",
        endedAt: "2026-07-20T00:05:00.000Z",
        wallMs: 5 * 60_000,
        activeMs: 5 * 60_000,
        eventCount: 1,
      },
    ]);
  });

  it("clamps wallMs to zero when now precedes the start (clock skew)", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_STARTED", "a", 10]), T0);
    expect(timings[0]?.wallMs).toBe(0);
    expect(warnings).toEqual(["clock skew: run a starts after now, wallMs clamped to 0"]);
  });

  it("returns nothing for an empty timeline", () => {
    expect(deriveStageTimings([], NOW)).toEqual({ timings: [], warnings: [] });
  });

  it("golden: the real record's runs are closed, ordered and non-overlapping", async () => {
    const { value } = expectOk(await readAllAuditEvents(REAL_RECORD));
    const { timings, warnings } = deriveStageTimings(value, Date.parse("2026-07-26T00:00:00Z"));
    const first21 = timings.slice(0, 21);

    expect(timings.length).toBeGreaterThanOrEqual(21);
    expect(first21.every((t) => t.endedAt !== null)).toBe(true);
    expect(timings.every((t) => t.activeMs <= t.wallMs)).toBe(true);
    expect(timings.every((t) => t.activeMs >= 0 && t.wallMs >= 0)).toBe(true);
    expect(first21.slice(0, 5).map((t) => t.stage)).toEqual([
      "workspace-scaffold",
      "workspace-detection",
      "state-init",
      "intent-capture",
      "feasibility",
    ]);
    // No run was abandoned, and none starts before the previous one ended.
    // These are what break if the same-second ordering regresses: a
    // STAGE_STARTED sorted ahead of the STAGE_COMPLETED it shares a second with
    // would abandon the open run instead of closing it.
    //
    // Runs are NOT asserted to be contiguous. The real record has a one-second
    // gap between refined-mockups and application-design — the engine does not
    // guarantee that a completion and the next start share a timestamp, only
    // that they usually do.
    expect(warnings.filter((w) => w.startsWith("stage run abandoned"))).toEqual([]);
    for (const [index, run] of first21.slice(1).entries()) {
      expect(Date.parse(run.startedAt)).toBeGreaterThanOrEqual(
        Date.parse(first21[index]?.endedAt ?? ""),
      );
    }
  });
});
