import type { AuditEvent } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { readAllAuditEvents } from "../src/audit/events.ts";
import { deriveStageTimings, IDLE_THRESHOLD_MS } from "../src/timing/derive.ts";
import { expectOk, REAL_RECORD } from "./paths.ts";

const T0 = Date.parse("2026-07-20T00:00:00Z");

/** Newest-first, like readAllAuditEvents — derive must sort for itself. */
function events(...rows: Array<[event: string, stage: string | null, offsetMin: number]>) {
  return rows
    .map(([event, stage, offsetMin]) => ({
      event,
      stage,
      timestamp: new Date(T0 + offsetMin * 60_000).toISOString(),
      shard: "a.md",
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
    expect(timings[0]?.activeMs).toBe(4 * 60_000);
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
  });

  it("skips a start with no stage name", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_STARTED", null, 0]), NOW);
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["STAGE_STARTED with no Stage field at 2026-07-20T00:00:00.000Z"]);
  });

  it("skips an unparseable timestamp", () => {
    const { timings, warnings } = deriveStageTimings(
      [{ event: "STAGE_STARTED", stage: "a", timestamp: "not-a-date", shard: "a.md" }],
      NOW,
    );
    expect(timings).toEqual([]);
    expect(warnings).toEqual(["unparseable timestamp: not-a-date"]);
  });

  it("clamps wallMs to zero when now precedes the start (clock skew)", () => {
    const { timings, warnings } = deriveStageTimings(events(["STAGE_STARTED", "a", 10]), T0);
    expect(timings[0]?.wallMs).toBe(0);
    expect(warnings).toEqual(["clock skew: run a starts after now, wallMs clamped to 0"]);
  });

  it("returns nothing for an empty timeline", () => {
    expect(deriveStageTimings([], NOW)).toEqual({ timings: [], warnings: [] });
  });

  // Structural invariants only, no exact durations: the real record grows every
  // time /aidlc runs, and team.md wants exact-value goldens pinned to a
  // snapshot. What this record uniquely exercises is 21 consecutive runs whose
  // STAGE_COMPLETED and the next STAGE_STARTED share a timestamp to the second
  // — the case the stable-sort tie-break exists for.
  it("golden: the real record's runs are closed, ordered and contiguous", async () => {
    const { value } = expectOk(await readAllAuditEvents(REAL_RECORD));
    const { timings } = deriveStageTimings(value, Date.parse("2026-07-26T00:00:00Z"));
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
    // Each run starts exactly where the previous one ended. This is what breaks
    // if the same-second ordering regresses.
    for (const [index, run] of first21.slice(1).entries()) {
      expect(run.startedAt).toBe(first21[index]?.endedAt);
    }
  });
});
