import { describe, expect, it } from "vitest";
import { getStageTimingSamples, getStageTimings } from "../src/timing/read.ts";
import { expectOk, fixture, REAL_RECORD, REPO_ROOT } from "./paths.ts";

const NOW = Date.parse("2026-07-26T00:00:00Z");

describe("getStageTimings", () => {
  // The `record` fixture opens `feasibility` at 11:00 and never closes it; the
  // 12:00 STAGE_COMPLETED names `intent-capture`, which never started. That is
  // an unmatched completion (Codex round 7 finding 1): it goes into
  // pendingCompletions and is reported as an orphan warning (it never
  // recovers) instead of being billed as activity on feasibility. Closes
  // nothing either way.
  it("derives runs from a record's audit shards", async () => {
    const { value } = expectOk(await getStageTimings(fixture("record"), NOW));
    expect(value).toEqual([
      {
        stage: "feasibility",
        startedAt: "2026-07-20T11:00:00Z",
        endedAt: null,
        wallMs: NOW - Date.parse("2026-07-20T11:00:00Z"),
        // 10m from the 11:00->12:00 gap (capped) plus a second 10m-capped tail
        // from the 12:00 event to `now`, itself many days later — the tail-gap
        // fix (timing/derive.ts) adds this second capped segment.
        activeMs: 20 * 60_000,
        eventCount: 1,
      },
    ]);
  });

  it("passes both shard warnings and derivation warnings through", async () => {
    const { warnings } = expectOk(await getStageTimings(fixture("record"), NOW));
    expect(warnings).toEqual([
      "audit shard skipped: unreadable-shard.md (not-a-file)",
      "STAGE_COMPLETED without STAGE_STARTED: intent-capture",
    ]);
  });

  it("returns an empty list when the record has no audit directory", async () => {
    const result = expectOk(await getStageTimings(fixture("golden"), NOW));
    expect(result.value).toEqual([]);
    expect(result.warnings).toBeUndefined();
  });

  it("reads the real record without writing to it", async () => {
    const { value } = expectOk(await getStageTimings(REAL_RECORD, NOW));
    expect(value.length).toBeGreaterThanOrEqual(21);
  });
});

describe("getStageTimingSamples", () => {
  it("concatenates every intent in the active space", async () => {
    const { value } = expectOk(await getStageTimingSamples(REPO_ROOT, NOW));
    expect(value.map((t) => t.stage)).toContain("code-generation");
  });

  it("returns an empty list when the workspace has no intents", async () => {
    const result = expectOk(await getStageTimingSamples(fixture("golden"), NOW));
    expect(result.value).toEqual([]);
  });

  // Asserted against a fixture, not the live record: the real workspace's
  // warning count varies with the workflow, and a `for (…of warnings ?? [])`
  // over an empty list asserts nothing.
  it("prefixes each intent's warnings with the intent name", async () => {
    const result = expectOk(await getStageTimingSamples(fixture("workspace"), NOW));
    expect(result.value.map((t) => t.stage)).toEqual(["intent-capture", "beta"]);
    expect(result.warnings).toEqual([
      "alpha-intent: audit shard skipped: broken.md (not-a-file)",
      // "other" never started — an unmatched completion (Codex round 7
      // finding 1) that goes into pendingCompletions and is reported as an
      // orphan, not billed as activity on "beta".
      "beta-intent: STAGE_COMPLETED without STAGE_STARTED: other",
    ]);
  });
});
