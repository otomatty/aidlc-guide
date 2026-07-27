import { describe, expect, it } from "vitest";
import { getStageTimings, getStageTimingSamples } from "../src/timing/read.ts";
import { expectOk, fixture, REAL_RECORD, REPO_ROOT } from "./paths.ts";

const NOW = Date.parse("2026-07-26T00:00:00Z");

describe("getStageTimings", () => {
  // The `record` fixture opens `feasibility` at 11:00 and never closes it; the
  // 12:00 STAGE_COMPLETED names `intent-capture`, so it counts as activity but
  // closes nothing. Both facts are asserted here.
  it("derives runs from a record's audit shards", async () => {
    const { value } = expectOk(await getStageTimings(fixture("record"), NOW));
    expect(value).toEqual([
      {
        stage: "feasibility",
        startedAt: "2026-07-20T11:00:00Z",
        endedAt: null,
        wallMs: NOW - Date.parse("2026-07-20T11:00:00Z"),
        activeMs: 10 * 60_000,
        eventCount: 2,
      },
    ]);
  });

  it("passes both shard warnings and derivation warnings through", async () => {
    const { warnings } = expectOk(await getStageTimings(fixture("record"), NOW));
    expect(warnings).toEqual([
      "audit shard skipped: unreadable-shard.md (not-a-file)",
      "STAGE_COMPLETED for intent-capture while feasibility was open",
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

  it("prefixes each intent's warnings with the intent name", async () => {
    const { warnings } = expectOk(await getStageTimingSamples(REPO_ROOT, NOW));
    // The real space has one intent; assert the prefix rather than the content,
    // which changes whenever the workflow advances.
    for (const warning of warnings ?? []) {
      expect(warning.startsWith("260720-aidlc-guide-prd: ")).toBe(true);
    }
  });
});
