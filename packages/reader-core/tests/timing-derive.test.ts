import type { AuditEvent } from "@aidlc-guide/shared-types";
import { describe, expect, it } from "vitest";
import { readAllAuditEvents } from "../src/audit/events.ts";
import { deriveStageTimings, IDLE_THRESHOLD_MS } from "../src/timing/derive.ts";
import { expectOk, REAL_RECORD } from "./paths.ts";

const T0 = Date.parse("2026-07-20T00:00:00Z");

/** Newest-first, like readAllAuditEvents — derive must sort for itself. */
function events(
  ...rows: Array<
    [
      event: string,
      stage: string | null,
      offsetMin: number,
      workflow?: string | null,
      shard?: string,
    ]
  >
) {
  return rows
    .map(([event, stage, offsetMin, workflow, shard]) => ({
      event,
      stage,
      timestamp: new Date(T0 + offsetMin * 60_000).toISOString(),
      shard: shard ?? "a.md",
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

  describe("concurrent runs (unit-major iteration, Codex round 5 finding 1)", () => {
    it("keeps two design stages open at once and closes both with sensible durations when completions arrive later in a cascade", () => {
      // stage-protocol.md's unit-major section: a directive's stage can name
      // a LATER design stage than Current Stage while an earlier one is
      // still open, and the gates "fire late and in a cascade at the end of
      // the design block". Simulated here: functional-design (f) opens,
      // then nfr-requirements (n) opens while f is still open, then both
      // close later, f first.
      const { timings, warnings } = deriveStageTimings(
        events(
          ["STAGE_STARTED", "f", 0],
          ["ARTIFACT_CREATED", null, 2], // f is the only run open — credited to f
          ["STAGE_STARTED", "n", 3], // f must NOT be abandoned by this
          ["ARTIFACT_CREATED", null, 5], // n is now most-recently-opened — credited to n, not f
          ["STAGE_COMPLETED", "f", 10],
          ["STAGE_COMPLETED", "n", 12],
        ),
        NOW,
      );
      expect(warnings).toEqual([]);
      expect(timings).toHaveLength(2);
      expect(timings[0]).toMatchObject({
        stage: "f",
        startedAt: "2026-07-20T00:00:00.000Z",
        endedAt: "2026-07-20T00:10:00.000Z",
        wallMs: 10 * 60_000,
        activeMs: 10 * 60_000, // 2m (own event) + 8m (gap to its own completion)
      });
      expect(timings[1]).toMatchObject({
        stage: "n",
        startedAt: "2026-07-20T00:03:00.000Z",
        endedAt: "2026-07-20T00:12:00.000Z",
        wallMs: 9 * 60_000,
        activeMs: 9 * 60_000, // 2m (own event) + 7m (gap to its own completion)
      });
      // The central invariant: neither run's activeMs exceeds its own wallMs,
      // even though the two runs overlapped in wall-clock time.
      for (const t of timings) expect(t.activeMs).toBeLessThanOrEqual(t.wallMs);
    });

    it("still abandons and warns on a same-stage double-START even while a different stage remains open", () => {
      // The unit-major fix must not weaken the genuine-abandonment case: a
      // SAME stage starting twice is still a real abandonment. A DIFFERENT
      // stage staying open throughout must be completely undisturbed by it.
      const { timings, warnings } = deriveStageTimings(
        events(
          ["STAGE_STARTED", "f", 0],
          ["STAGE_STARTED", "n", 2], // f stays open
          ["STAGE_STARTED", "f", 4], // double-start of f: abandons the first f attempt
          ["STAGE_COMPLETED", "f", 6],
          ["STAGE_COMPLETED", "n", 8],
        ),
        NOW,
      );
      expect(warnings).toEqual(["stage run abandoned without completion: f"]);
      expect(timings).toHaveLength(2);
      const f = timings.find((t) => t.stage === "f");
      const n = timings.find((t) => t.stage === "n");
      // f's surviving run is the SECOND start (at +4m), not the first.
      expect(f).toMatchObject({
        startedAt: "2026-07-20T00:04:00.000Z",
        endedAt: "2026-07-20T00:06:00.000Z",
      });
      // n was never touched by f's double-start — its own start time survives.
      expect(n).toMatchObject({
        startedAt: "2026-07-20T00:02:00.000Z",
        endedAt: "2026-07-20T00:08:00.000Z",
      });
    });

    it("recovers a cross-shard skew completion via pendingCompletions even while a different stage is open (Codex round 7 finding 1)", () => {
      // Before the fix: "a" being open routed b's mismatched completion into
      // the "bill whatever is open" branch instead of pendingCompletions, so
      // b's later STAGE_STARTED never found anything to recover against and
      // stayed open forever — corrupting both b's own duration and a's.
      const { timings, warnings } = deriveStageTimings(
        events(
          ["STAGE_STARTED", "a", 0],
          // b's completion sorts before its own start — the cross-shard skew
          // case — while "a" is still open.
          ["STAGE_COMPLETED", "b", 3],
          ["STAGE_STARTED", "b", 5],
          ["STAGE_COMPLETED", "a", 10],
        ),
        NOW,
      );
      // Recovered as a zero-duration run, not left open, and NOT reported as
      // "STAGE_COMPLETED for b while a was open" (the old mismatch-bill path).
      expect(warnings).toEqual([
        "clock skew: STAGE_COMPLETED for b was recorded before its STAGE_STARTED (shards disagree on the clock) — closed as a zero-duration run",
      ]);
      // No run left open at all — the central symptom the bug produced.
      expect(timings.every((t) => t.endedAt !== null)).toBe(true);
      const b = timings.find((t) => t.stage === "b");
      const a = timings.find((t) => t.stage === "a");
      expect(b).toMatchObject({
        startedAt: "2026-07-20T00:05:00.000Z",
        endedAt: "2026-07-20T00:03:00.000Z",
        wallMs: 0,
        activeMs: 0,
      });
      // "a" closes normally, on its own gap alone (0 to 10m) — b's mismatched
      // completion and recovery do not disturb it.
      expect(a).toMatchObject({
        startedAt: "2026-07-20T00:00:00.000Z",
        endedAt: "2026-07-20T00:10:00.000Z",
        wallMs: 10 * 60_000,
        activeMs: 10 * 60_000,
      });
    });
  });

  describe("STAGE_SKIPPED (Codex round 5 finding 2)", () => {
    it("discards a stage's run when it is skipped while active, leaving no open run and no timing entry to pollute the estimate pool", () => {
      // stage-protocol.md's conditional-skip section: the engine "preserves
      // [S], emits one STAGE_SKIPPED, and starts the next in-scope stage ...
      // without emitting STAGE_COMPLETED". Only STAGE_COMPLETED closed a run
      // before this fix, so "a" would stay open forever.
      const { timings, warnings } = deriveStageTimings(
        events(
          ["STAGE_STARTED", "a", 0],
          ["ARTIFACT_CREATED", null, 2],
          ["STAGE_SKIPPED", "a", 5],
          ["STAGE_STARTED", "b", 5],
          ["STAGE_COMPLETED", "b", 10],
        ),
        NOW,
      );
      expect(warnings).toEqual([]);
      // No "a" entry at all — not open, not closed. estimate.ts's sample
      // pool is built entirely from this array, so there is nothing here
      // that could ever be mistaken for a completed run of "a".
      expect(timings.some((t) => t.stage === "a")).toBe(false);
      expect(timings).toEqual([
        {
          stage: "b",
          startedAt: "2026-07-20T00:05:00.000Z",
          endedAt: "2026-07-20T00:10:00.000Z",
          wallMs: 5 * 60_000,
          activeMs: 5 * 60_000,
          eventCount: 1,
        },
      ]);
    });

    it("leaves no open run at all when the FINAL in-scope stage is skipped — the case that would otherwise poll forever", () => {
      const { timings, warnings } = deriveStageTimings(
        events(["STAGE_STARTED", "a", 0], ["ARTIFACT_CREATED", null, 2], ["STAGE_SKIPPED", "a", 5]),
        NOW,
      );
      expect(warnings).toEqual([]);
      // Nothing left in `timings` at all: no `endedAt: null` entry for the
      // dashboard's open-run poll to keep re-fetching after the workflow
      // has already completed.
      expect(timings).toEqual([]);
    });
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

  it("warns when a completion names a different stage than the open run (Codex round 7 finding 1: routed to pendingCompletions, not billed to the open run)", () => {
    // "b" never started, so its completion is an orphan — it goes into
    // pendingCompletions (silently, unless a second one for "b" arrives) and
    // is reported as an orphan warning at the end, exactly like the
    // openRuns-empty case already did. It is deliberately NOT credited as
    // activity on "a": a completion names the stage it is evidence FOR, not
    // whichever run happens to still be open (see the comment on the
    // STAGE_COMPLETED mismatch branch in derive.ts).
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_STARTED", "a", 0], ["STAGE_COMPLETED", "b", 5], ["STAGE_COMPLETED", "a", 6]),
      NOW,
    );
    expect(timings).toHaveLength(1);
    expect(warnings).toEqual(["STAGE_COMPLETED without STAGE_STARTED: b"]);
    // "a" still closes correctly on its own gap alone (0 to 6m) — the
    // mismatched completion at +5m does not close, credit, or otherwise
    // disturb it.
    expect(timings[0]).toMatchObject({
      stage: "a",
      endedAt: "2026-07-20T00:06:00.000Z",
      activeMs: 6 * 60_000,
      eventCount: 1,
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

  it("clamps activeMs to wallMs when the writer's clock is ahead of the reader's (finding 1)", () => {
    // Reproduction from the Codex review: the run starts at now+10m (writer
    // clock ahead of reader clock) and a second event lands at now+15m — both
    // squarely in the reader's future. wallMs is already clamped to 0, but
    // before this fix activeMs accumulated the 5m gap between those two
    // events regardless, breaking `activeMs <= wallMs`.
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_STARTED", "a", 10], ["ARTIFACT_CREATED", null, 15]),
      T0,
    );
    expect(timings[0]?.wallMs).toBe(0);
    expect(timings[0]?.activeMs).toBe(0);
    expect(timings[0]?.activeMs).toBeLessThanOrEqual(timings[0]?.wallMs as number);
    expect(warnings).toEqual(["clock skew: run a starts after now, wallMs clamped to 0"]);
  });

  it("pairs a same-second, same-stage start and completion even when the completion's shard sorts first (cross-shard tie, Codex round 4 finding)", () => {
    // Two clones: the start lands in shard "zzz.md", the completion in "aaa.md",
    // both stamped the same second. The plain shard tiebreak would put the
    // completion first and strand the start open forever; the stage-aware
    // pairing rule must override that and pair them normally.
    const { timings, warnings } = deriveStageTimings(
      events(
        ["STAGE_STARTED", "alpha", 5, null, "zzz.md"],
        ["STAGE_COMPLETED", "alpha", 5, null, "aaa.md"],
      ),
      NOW,
    );
    expect(warnings).toEqual([]);
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({
      stage: "alpha",
      endedAt: "2026-07-20T00:05:00.000Z",
      wallMs: 0,
      activeMs: 0,
    });
  });

  it("keeps stage A's completion ordered before stage B's start when they share a second (dominant real pattern, must stay intact)", () => {
    // Different stages sharing a second is the normal case (one stage ends,
    // the next begins in the same tick) — the new same-stage pairing rule
    // must not touch it. If it wrongly fired here, B's start would sort
    // ahead of A's completion, abandoning A's run and mismatching B's. Uses
    // distinct shards for the tied pair (as a real cross-clone tie would) so
    // the outcome is decided by the shard tiebreak, not by incidental input
    // order / sort stability on an exact (shard, timestamp) duplicate.
    const { timings, warnings } = deriveStageTimings(
      events(
        ["STAGE_STARTED", "alpha", 0],
        ["STAGE_COMPLETED", "alpha", 5, null, "aaa.md"],
        ["STAGE_STARTED", "beta", 5, null, "zzz.md"],
        ["STAGE_COMPLETED", "beta", 10],
      ),
      NOW,
    );
    expect(warnings).toEqual([]);
    expect(timings).toHaveLength(2);
    expect(timings[0]).toMatchObject({ stage: "alpha", endedAt: "2026-07-20T00:05:00.000Z" });
    expect(timings[1]).toMatchObject({
      stage: "beta",
      startedAt: "2026-07-20T00:05:00.000Z",
      endedAt: "2026-07-20T00:10:00.000Z",
    });
  });

  it("recovers a completion recorded strictly before its start (cross-clone clock skew) as a zero-duration run instead of leaving the start open forever", () => {
    const { timings, warnings } = deriveStageTimings(
      events(
        ["STAGE_COMPLETED", "alpha", 0, null, "aaa.md"],
        ["STAGE_STARTED", "alpha", 5, null, "bbb.md"],
      ),
      NOW,
    );
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({
      stage: "alpha",
      startedAt: "2026-07-20T00:05:00.000Z",
      endedAt: "2026-07-20T00:00:00.000Z",
      wallMs: 0,
      activeMs: 0,
    });
    expect(warnings).toEqual([
      "clock skew: STAGE_COMPLETED for alpha was recorded before its STAGE_STARTED (shards disagree on the clock) — closed as a zero-duration run",
    ]);
    // No open run left behind for the current-stage poll to chase forever.
    expect(timings.some((t) => t.endedAt === null)).toBe(false);
  });

  it("still reports the existing unmatched-completion warning when a completion never finds a same-stage start at all", () => {
    const { timings, warnings } = deriveStageTimings(
      events(["STAGE_COMPLETED", "alpha", 0], ["STAGE_STARTED", "beta", 5]),
      NOW,
    );
    // "beta" opens and stays open (measured against NOW); "alpha"'s completion
    // never gets a same-stage start, so it must still warn as an orphan, not
    // silently vanish and not be mistaken for beta's pairing.
    expect(timings).toHaveLength(1);
    expect(timings[0]?.stage).toBe("beta");
    expect(warnings).toEqual(["STAGE_COMPLETED without STAGE_STARTED: alpha"]);
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
