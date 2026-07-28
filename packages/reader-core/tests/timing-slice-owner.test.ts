import { describe, expect, it } from "vitest";
import { sliceOwner } from "../src/timing/attribution.ts";

/**
 * The single decision (issue #8). Under the timeline-partition form every
 * slice of wall time is handed to at most one run, so the only thing left
 * that can go wrong is WHICH run — and that is decided here, by one pure
 * function over plain data. All six of PR #4's attribution bugs reduce to a
 * row in this file, which is why the exhaustive tests live here rather than
 * being spread over end-to-end traces.
 *
 * `openStages` is ordered: the LAST entry is the most recently opened run.
 * "a" is open-but-not-latest, "b" is the latest, "z" is never open.
 */

const KINDS = ["STAGE_STARTED", "STAGE_COMPLETED", "STAGE_SKIPPED", "ARTIFACT_CREATED"] as const;
const STAGES = [null, "a", "b", "z"] as const;
const COMPLETES = [null, "a", "z"] as const;
// `["b", "a"]` as well as `["a", "b"]` (PR#14 review): with one order only, an
// implementation picking the alphabetically-last or the FIRST open stage would
// satisfy every assertion below. Both orders pin "the last one yielded".
const OPEN_SETS = [[], ["a", "b"], ["b", "a"]] as const;

interface Case {
  kind: string;
  stage: string | null;
  completes: string | null;
  openStages: readonly string[];
  owner: string | null;
}

/** Every combination that can reach `sliceOwner`, with the answer it gave. */
const ALL: Case[] = KINDS.flatMap((kind) =>
  STAGES.flatMap((stage) =>
    COMPLETES.flatMap((completes) =>
      OPEN_SETS.map((openStages) => ({
        kind,
        stage,
        completes,
        openStages,
        owner: sliceOwner({ event: { event: kind, stage }, completes, openStages }),
      })),
    ),
  ),
);

const lifecycle = (c: Case) => c.kind !== "ARTIFACT_CREATED";

describe("sliceOwner — landmark cases, one per attribution bug the old form allowed", () => {
  it("gives an unnamed event to the most recently opened run (unit-major: work lands on the stage that opened last)", () => {
    expect(
      sliceOwner({
        event: { event: "ARTIFACT_CREATED", stage: null },
        completes: null,
        openStages: ["a", "b"],
      }),
    ).toBe("b");
  });

  it("gives a stage-named event to that stage's run even when a later-opened run exists (R11: the idle stage waiting on its own gate must not be credited)", () => {
    expect(
      sliceOwner({
        event: { event: "ARTIFACT_CREATED", stage: "a" },
        completes: null,
        openStages: ["a", "b"],
      }),
    ).toBe("a");
  });

  it("gives a stage-named event with no open run to NOBODY, not to the most recently opened (R10: a per-Unit artifact landing before its own stage started)", () => {
    expect(
      sliceOwner({
        event: { event: "ARTIFACT_CREATED", stage: "z" },
        completes: null,
        openStages: ["a", "b"],
      }),
    ).toBeNull();
  });

  it("gives a STAGE_STARTED's slice to nobody — the span before a start belongs to whatever preceded it, never to the run being opened (R14)", () => {
    expect(
      sliceOwner({
        event: { event: "STAGE_STARTED", stage: "b" },
        completes: null,
        openStages: ["a", "b"],
      }),
    ).toBeNull();
  });

  it("gives a STAGE_SKIPPED's slice to nobody — a skipped run is discarded, not billed", () => {
    expect(
      sliceOwner({
        event: { event: "STAGE_SKIPPED", stage: "a" },
        completes: null,
        openStages: ["a", "b"],
      }),
    ).toBeNull();
  });

  it("gives a STAGE_COMPLETED's slice to the run it closes, even though a different run opened later", () => {
    expect(
      sliceOwner({
        event: { event: "STAGE_COMPLETED", stage: "a" },
        completes: "a",
        openStages: ["a", "b"],
      }),
    ).toBe("a");
  });

  it("gives a STAGE_COMPLETED that closes nothing to NOBODY, not to the most recently opened (the cross-shard skew case pairing routes to pendingTerminals)", () => {
    expect(
      sliceOwner({
        event: { event: "STAGE_COMPLETED", stage: "z" },
        completes: null,
        openStages: ["a", "b"],
      }),
    ).toBeNull();
  });

  it("owns nothing at all when no run is open — an event before the first start, or after the last close", () => {
    for (const kind of KINDS) {
      for (const stage of STAGES) {
        expect(
          sliceOwner({ event: { event: kind, stage }, completes: stage, openStages: [] }),
        ).toBe(null);
      }
    }
  });
});

describe("sliceOwner — exhaustive over every reachable combination", () => {
  it("never names a run that is not open (a slice can only go to a live run)", () => {
    for (const c of ALL) {
      if (c.owner !== null) expect(c.openStages).toContain(c.owner);
    }
  });

  it("never gives a slice to a lifecycle event's run except a completion closing it", () => {
    // STARTED/SKIPPED own nothing at all; COMPLETED owns exactly `completes`,
    // and only when `completes` is genuinely open.
    for (const c of ALL.filter(lifecycle)) {
      if (c.kind === "STAGE_COMPLETED") {
        const closesLiveRun = c.completes !== null && c.openStages.includes(c.completes);
        expect(c.owner).toBe(closesLiveRun ? c.completes : null);
      } else {
        expect(c.owner).toBeNull();
      }
    }
  });

  it("routes a non-lifecycle event by its own Stage field, falling back to the latest run only when it names none", () => {
    for (const c of ALL.filter((x) => !lifecycle(x))) {
      if (c.stage !== null) {
        expect(c.owner).toBe(c.openStages.includes(c.stage) ? c.stage : null);
      } else {
        expect(c.owner).toBe(c.openStages.at(-1) ?? null);
      }
    }
  });

  it("ignores `completes` entirely unless the event is a STAGE_COMPLETED", () => {
    // Pass 1 decides which event closes which run; a non-completion carrying a
    // stale `completes` must not change the answer.
    for (const c of ALL.filter((x) => x.kind !== "STAGE_COMPLETED")) {
      const withoutCompletes = sliceOwner({
        event: { event: c.kind, stage: c.stage },
        completes: null,
        openStages: c.openStages,
      });
      expect(c.owner).toBe(withoutCompletes);
    }
  });

  it("is not vacuous: the cross-product really reaches every outcome class", () => {
    // Without this, a rule that stopped firing (or a domain that stopped
    // covering it) would leave the loops above quietly asserting nothing.
    const outcomes = new Set(
      ALL.map((c) => {
        if (c.owner === null) return "unowned";
        if (c.kind === "STAGE_COMPLETED") return "owner:completes";
        if (c.stage === c.owner) return "owner:named-stage";
        return "owner:most-recently-opened";
      }),
    );
    expect([...outcomes].sort()).toEqual([
      "owner:completes",
      "owner:most-recently-opened",
      "owner:named-stage",
      "unowned",
    ]);
  });
});
