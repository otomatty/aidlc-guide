import type { AuditEvent, StageInfo, WorkflowModel } from "@aidlc-guide/shared-types";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { attributeRuns } from "../src/timing/attribution.ts";
import { deriveStageTimings } from "../src/timing/derive.ts";
import { estimateRemaining } from "../src/timing/estimate.ts";
import { pairRuns } from "../src/timing/pairing.ts";

/**
 * Property-based adversarial search over the timing pipeline (issue #7).
 *
 * PR #4 took ~15 external-review rounds and ~20 findings, most of which were
 * the reviewer generating a protocol-legal event sequence and hunting for the
 * combination that broke an invariant. That search is mechanical, so this
 * file mechanises it: generate a legal trace, inject the corruptions a real
 * multi-clone audit log suffers (shard split, clock skew, dropped events,
 * missing `Stage` fields, same-second collisions), run `pairRuns` →
 * `attributeRuns`, and assert the invariants below. fast-check shrinks any
 * violation to a minimal counterexample.
 *
 * The invariant list IS the specification — each row names the round that
 * broke it:
 *   P1  0 <= activeMs <= wallMs, every run                    (R3)
 *   P2  sum(activeMs) <= the wall span the runs jointly cover (R9)
 *   P3  conservation: every STAGE_STARTED lands in exactly one
 *       of closed / abandoned-with-warning / open, and no run
 *       stays open past a terminal event for its own stage     (R4, R11, skips)
 *   P4  a workflow whose stages all finished has remaining 0  (R13, R15)
 *   P5  determinism: an order-preserving shard re-split does
 *       not change the derived result                          (R4)
 *
 * Production code is untouched: this is a net for the changes that come
 * after it.
 */

const T0 = Date.parse("2026-07-20T00:00:00Z");
const STAGES = ["alpha", "bravo", "charlie", "delta"] as const;

/** Pre-serialisation event: absolute ms, no shard yet (corruption assigns it). */
interface RawEvent {
  event: string;
  stage: string | null;
  at: number;
  workflow: string | null;
}

interface Step {
  kind: "start" | "work" | "close" | "skip-unstarted" | "single";
  stage: number;
  which: number;
  flag: boolean;
  gapS: number;
}

/**
 * Weighted, not uniform. A uniform kind draw spent most of its traces on
 * orphaned skips and left `completed` runs, concurrent runs and the clock-skew
 * recovery paths barely exercised — a generator that never reaches the
 * interesting states is a vacuous net. `generator reach` below is the guard
 * that keeps these weights honest.
 */
const kindArb = fc.oneof(
  { weight: 6, arbitrary: fc.constant("start" as const) },
  { weight: 6, arbitrary: fc.constant("work" as const) },
  { weight: 5, arbitrary: fc.constant("close" as const) },
  { weight: 1, arbitrary: fc.constant("skip-unstarted" as const) },
  { weight: 2, arbitrary: fc.constant("single" as const) },
);

function stepArb(minGapS: number): fc.Arbitrary<Step> {
  return fc.record({
    kind: kindArb,
    stage: fc.nat(STAGES.length - 1),
    which: fc.nat(STAGES.length - 1),
    flag: fc.boolean(),
    gapS: fc.oneof(
      // Mostly tight, so same-second ties and skew-induced reordering are
      // common rather than freak events...
      { weight: 3, arbitrary: fc.integer({ min: minGapS, max: 120 }) },
      // ...but long enough, often enough, to land on both sides of
      // IDLE_THRESHOLD_MS.
      { weight: 1, arbitrary: fc.integer({ min: minGapS, max: 1800 }) },
    ),
  });
}

function stageAt(index: number): string {
  return STAGES[index % STAGES.length] as string;
}

/**
 * Interprets steps against the live set of open stages so the trace stays
 * protocol-LEGAL: no stage double-starts, nothing closes that never opened,
 * several stages may be open at once (unit-major iteration), a stage may be
 * re-run after it closed (backward jump), and `single-stage:` pairs interleave
 * with the main workflow. Everything illegal is injected later, by `corrupt`.
 */
function buildTrace(steps: readonly Step[], distinct: boolean): RawEvent[] {
  const out: RawEvent[] = [];
  const open: string[] = [];
  let clock = T0;

  for (const step of steps) {
    clock += step.gapS * 1000;
    switch (step.kind) {
      case "start": {
        const stage = stageAt(step.stage);
        if (open.includes(stage)) break;
        out.push({ event: "STAGE_STARTED", stage, at: clock, workflow: null });
        open.push(stage);
        break;
      }
      case "work": {
        // Most audit events carry no `**Stage**` field at all; a stage-keyed
        // one (a sensor fire naming its stage) is the minority case.
        const named = step.flag && open.length > 0;
        const stage = named ? (open[step.which % open.length] as string) : null;
        out.push({ event: "ARTIFACT_CREATED", stage, at: clock, workflow: null });
        break;
      }
      case "close": {
        if (open.length === 0) break;
        const index = step.which % open.length;
        const stage = open[index] as string;
        out.push({
          event: step.flag ? "STAGE_SKIPPED" : "STAGE_COMPLETED",
          stage,
          at: clock,
          workflow: null,
        });
        open.splice(index, 1);
        break;
      }
      case "skip-unstarted": {
        // Conditional skip of an out-of-scope stage: the engine emits
        // STAGE_SKIPPED without ever having started it.
        const stage = stageAt(step.stage);
        if (open.includes(stage)) break;
        out.push({ event: "STAGE_SKIPPED", stage, at: clock, workflow: null });
        break;
      }
      case "single": {
        const stage = stageAt(step.stage);
        const workflow = `single-stage:${stage}`;
        out.push({ event: "STAGE_STARTED", stage, at: clock, workflow });
        clock += 1000;
        out.push({ event: "STAGE_COMPLETED", stage, at: clock, workflow });
        break;
      }
    }
    if (distinct) clock += 1000; // guarantees no two events share a second
  }
  return out;
}

interface Corruption {
  shardCount: number;
  /** Round-robin across shards vs. contiguous blocks — both occur for real. */
  interleave: boolean;
  /** Per-shard clock offset in seconds: clones do not agree on the clock. */
  skewS: number[];
  dropIdx: number[];
  nullStageIdx: number[];
  garbleIdx: number[];
}

const corruptionArb: fc.Arbitrary<Corruption> = fc.record({
  shardCount: fc.integer({ min: 1, max: 3 }),
  interleave: fc.boolean(),
  skewS: fc.array(fc.integer({ min: -300, max: 300 }), { minLength: 3, maxLength: 3 }),
  dropIdx: fc.array(fc.nat(255), { maxLength: 5 }),
  nullStageIdx: fc.array(fc.nat(255), { maxLength: 3 }),
  garbleIdx: fc.array(fc.nat(255), { maxLength: 2 }),
});

function toShards(raw: readonly RawEvent[], shardCount: number, interleave: boolean): AuditEvent[] {
  return raw.map((event, i) => {
    const shard = interleave
      ? i % shardCount
      : Math.min(Math.floor((i * shardCount) / Math.max(raw.length, 1)), shardCount - 1);
    return {
      event: event.event,
      stage: event.stage,
      timestamp: new Date(event.at).toISOString(),
      shard: `${shard}.md`,
      workflow: event.workflow,
    };
  });
}

function corrupt(raw: readonly RawEvent[], c: Corruption): AuditEvent[] {
  const modulus = Math.max(raw.length, 1);
  const dropped = new Set(c.dropIdx.map((n) => n % modulus));
  const nulled = new Set(c.nullStageIdx.map((n) => n % modulus));
  const garbled = new Set(c.garbleIdx.map((n) => n % modulus));

  return toShards(raw, c.shardCount, c.interleave)
    .map((event, i) => {
      const shard = Number(event.shard.slice(0, -3));
      const skewMs = (c.skewS[shard] ?? 0) * 1000;
      return {
        ...event,
        stage: nulled.has(i) ? null : event.stage,
        timestamp: garbled.has(i)
          ? "not-a-timestamp"
          : new Date(Date.parse(event.timestamp) + skewMs).toISOString(),
      };
    })
    .filter((_, i) => !dropped.has(i))
    .reverse(); // readAllAuditEvents hands the pipeline newest-first
}

const traceArb = (minGapS: number, distinct: boolean) =>
  fc
    .array(stepArb(minGapS), { minLength: 1, maxLength: 60 })
    .map((steps) => buildTrace(steps, distinct));

/** Last event's instant, or T0 for an empty trace. */
function lastAt(raw: readonly RawEvent[]): number {
  return raw.reduce((max, e) => Math.max(max, e.at), T0);
}

const RUNS = { numRuns: 300 } as const;

describe("timing pipeline invariants (property-based)", () => {
  it("P1: every reported run satisfies 0 <= activeMs <= wallMs", () => {
    fc.assert(
      fc.property(
        traceArb(0, false),
        corruptionArb,
        // now can also land BEFORE the newest event: the reader's clock and
        // the writer's clock are not the same clock.
        fc.integer({ min: -600, max: 3600 }),
        (raw, c, nowGapS) => {
          const { timings } = deriveStageTimings(corrupt(raw, c), lastAt(raw) + nowGapS * 1000);
          for (const t of timings) {
            expect(Number.isFinite(t.activeMs)).toBe(true);
            expect(Number.isFinite(t.wallMs)).toBe(true);
            expect(t.activeMs).toBeGreaterThanOrEqual(0);
            expect(t.wallMs).toBeGreaterThanOrEqual(0);
            expect(t.activeMs).toBeLessThanOrEqual(t.wallMs);
            expect(t.eventCount).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      RUNS,
    );
  });

  it("P2: summed activeMs never exceeds the wall span the runs jointly cover", () => {
    fc.assert(
      fc.property(
        traceArb(0, false),
        corruptionArb,
        fc.integer({ min: -600, max: 3600 }),
        (raw, c, nowGapS) => {
          const now = lastAt(raw) + nowGapS * 1000;
          const { timings } = deriveStageTimings(corrupt(raw, c), now);
          if (timings.length === 0) return;
          // Concurrent runs (unit-major) overlap, so the bound is the single
          // span they all live inside — not the sum of their own wallMs.
          const starts = timings.map((t) => Date.parse(t.startedAt));
          const ends = timings.map((t) => (t.endedAt === null ? now : Date.parse(t.endedAt)));
          const span = Math.max(0, Math.max(...ends, now) - Math.min(...starts));
          const totalActive = timings.reduce((sum, t) => sum + t.activeMs, 0);
          expect(totalActive).toBeLessThanOrEqual(span);
        },
      ),
      RUNS,
    );
  });

  it("P3: every STAGE_STARTED lands in exactly one disposition, and no run outlives its own terminal event", () => {
    fc.assert(
      fc.property(
        traceArb(0, false),
        corruptionArb,
        fc.integer({ min: -600, max: 3600 }),
        (raw, c, nowGapS) => {
          const events = corrupt(raw, c);
          const pairing = pairRuns(events);
          const attribution = attributeRuns(
            pairing.events,
            pairing.boundaries,
            lastAt(raw) + nowGapS * 1000,
          );

          // Conservation: one boundary per surviving STAGE_STARTED. Pairing
          // rejects three kinds outright (single-stage isolation, unparseable
          // timestamp, missing Stage field); everything else must produce a
          // run with exactly one disposition.
          const surviving = events.filter(
            (e) =>
              e.event === "STAGE_STARTED" &&
              e.workflow?.startsWith("single-stage:") !== true &&
              !Number.isNaN(Date.parse(e.timestamp)) &&
              e.stage !== null,
          );
          expect(pairing.boundaries).toHaveLength(surviving.length);

          const openPerStage = new Map<string, number>();
          for (const b of pairing.boundaries) {
            // Every boundary is measured — none silently falls out of pass 2.
            expect(attribution.results.has(b)).toBe(true);
            if (b.openIndex !== null && b.closeIndex !== null) {
              expect(b.openIndex).toBeLessThan(b.closeIndex);
            }
            // Only `open` has no close; everything else is resolved.
            expect(b.closeIndex === null).toBe(b.disposition === "open");
            if (b.disposition !== "open") continue;
            openPerStage.set(b.stage, (openPerStage.get(b.stage) ?? 0) + 1);
            // The permanently-open run (R4/R11/skip path): a run left open
            // although a terminal event for its own stage arrived after it.
            const outlived = pairing.events.findIndex(
              (e, i) =>
                i > (b.openIndex ?? -1) &&
                e.stage === b.stage &&
                (e.event === "STAGE_COMPLETED" || e.event === "STAGE_SKIPPED"),
            );
            expect(outlived).toBe(-1);
          }
          for (const count of openPerStage.values()) expect(count).toBe(1);

          // An abandoned run is never silent — it always warns.
          const abandoned = pairing.boundaries.filter((b) => b.disposition === "abandoned");
          const abandonWarnings = pairing.warnings.filter((w) =>
            w.startsWith("stage run abandoned without completion:"),
          );
          expect(abandonWarnings).toHaveLength(abandoned.length);
        },
      ),
      RUNS,
    );
  });

  it("P4: a workflow whose every stage finished has nothing remaining", () => {
    fc.assert(
      fc.property(traceArb(1, true), (raw) => {
        // Close whatever the trace left open, so the state file this models
        // ("Status: Completed") and the audit log actually agree.
        const closedAt = lastAt(raw) + 60_000;
        const stillOpen = new Set<string>();
        for (const e of raw) {
          if (e.workflow !== null) continue;
          if (e.event === "STAGE_STARTED") stillOpen.add(e.stage as string);
          if (e.event === "STAGE_COMPLETED" || e.event === "STAGE_SKIPPED") {
            stillOpen.delete(e.stage as string);
          }
        }
        const complete: RawEvent[] = [
          ...raw,
          ...[...stillOpen].map((stage) => ({
            event: "STAGE_COMPLETED",
            stage,
            at: closedAt,
            workflow: null,
          })),
        ];

        const { timings } = deriveStageTimings(toShards(complete, 1, false), closedAt + 60_000);
        const finished = timings.filter((t) => t.endedAt !== null);
        fc.pre(finished.length > 0);
        // Every run closed, so nothing is left in flight.
        expect(timings.every((t) => t.endedAt !== null)).toBe(true);

        const slugs = [...new Set(finished.map((t) => t.stage))];
        const stages: StageInfo[] = slugs.map((slug) => ({
          slug,
          phase: "CONSTRUCTION",
          execution: "EXECUTE",
          status: "completed",
        }));
        const workflow: WorkflowModel = {
          project: "p",
          scope: "feature",
          depth: "practical",
          stateVersion: 7,
          phase: "CONSTRUCTION",
          currentStage: slugs[slugs.length - 1] as string,
          nextStage: null,
          gate: null,
          stages,
          done: stages.length,
          total: stages.length,
        };

        const estimate = estimateRemaining(timings, workflow, timings);
        expect(estimate.totalRemainingMs).toBe(0);
        expect(estimate.pendingStages).toEqual([]);
        expect(estimate.currentStage?.remainingMs).toBe(0);
      }),
      RUNS,
    );
  });

  it("P5: an order-preserving shard re-split does not change the derived result", () => {
    fc.assert(
      fc.property(
        // Distinct timestamps only: with a same-second tie the shard name IS
        // the documented tiebreak (compareByTime), so re-sharding legitimately
        // reorders. What must never move is everything else.
        traceArb(1, true),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 3600 }),
        (raw, shardsA, shardsB, interleaveB, nowGapS) => {
          const now = lastAt(raw) + nowGapS * 1000;
          const a = deriveStageTimings(toShards(raw, shardsA, false), now);
          const b = deriveStageTimings(toShards(raw, shardsB, interleaveB).reverse(), now);
          expect(b.timings).toEqual(a.timings);
          expect(b.warnings).toEqual(a.warnings);
        },
      ),
      RUNS,
    );
  });
  /**
   * The properties above are only worth their runtime if the generator
   * actually reaches the states that broke in review. A green suite whose
   * generator stopped producing clock-skew recoveries or concurrent runs is
   * indistinguishable from a green suite that genuinely holds — so assert the
   * reach explicitly. If a future edit to the weights above starves one of
   * these, this fails loudly instead of the net going quietly vacuous.
   *
   * `recovered-completed` is the rarest (~0.4% of cases): it needs a
   * STAGE_COMPLETED to sort BEFORE its own STAGE_STARTED, which takes the pair
   * landing in different shards whose clocks disagree by more than the gap
   * between them. The run count is sized so that even that one is effectively
   * certain rather than seeded — a pinned seed would go stale the moment
   * fast-check's generator changes.
   */
  it("generator reach: the search visits every disposition and every warning class", () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(
        traceArb(0, false),
        corruptionArb,
        fc.integer({ min: -600, max: 3600 }),
        (raw, c, nowGapS) => {
          const events = corrupt(raw, c);
          const pairing = pairRuns(events);
          for (const b of pairing.boundaries) seen.add(`disposition:${b.disposition}`);
          for (const w of pairing.warnings) {
            if (w.startsWith("clock skew:")) seen.add("warn:clock-skew");
            else if (w.startsWith("unparseable timestamp:")) seen.add("warn:unparseable");
            else if (w.includes("no Stage field")) seen.add("warn:null-stage");
            else if (w.startsWith("stage run abandoned")) seen.add("warn:abandoned");
            else seen.add("warn:orphan-terminal");
          }
          const { timings } = deriveStageTimings(events, lastAt(raw) + nowGapS * 1000);
          if (timings.length > 1) seen.add("shape:several-runs");
          if (timings.some((t) => t.endedAt === null)) seen.add("shape:open-run");
          // Unit-major: three or more design stages open at the same time.
          if (pairing.boundaries.filter((b) => b.openIndex !== null).length > 2) {
            seen.add("shape:concurrent");
          }
        },
      ),
      { numRuns: 4000 },
    );
    expect([...seen].sort()).toEqual([
      "disposition:abandoned",
      "disposition:completed",
      "disposition:open",
      "disposition:recovered-completed",
      "disposition:recovered-skipped",
      "disposition:skipped",
      "shape:concurrent",
      "shape:open-run",
      "shape:several-runs",
      "warn:abandoned",
      "warn:clock-skew",
      "warn:null-stage",
      "warn:orphan-terminal",
      "warn:unparseable",
    ]);
  });
});
