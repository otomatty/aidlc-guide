import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReader } from "../src/index.ts";
import { getStageTimingSamples, getStageTimings } from "../src/timing/read.ts";
import { expectOk, fixture, REAL_RECORD, REPO_ROOT } from "./paths.ts";

const NOW = Date.parse("2026-07-26T00:00:00Z");
const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("getStageTimings", () => {
  it("retains run boundaries but reports work as unknown when a shard cannot be read", async () => {
    const { value } = expectOk(await getStageTimings(fixture("record"), NOW));
    expect(value).toMatchObject([
      {
        stage: "feasibility",
        startedAt: "2026-07-20T11:00:00Z",
        endedAt: null,
        wallMs: NOW - Date.parse("2026-07-20T11:00:00Z"),
        activeMs: null,
        breakdown: null,
        quality: { status: "incomplete", sampleEligible: false },
      },
    ]);
    expect(value[0]?.quality?.reasons).toContain("audit-read-incomplete");
    expect(value[0]?.sensitivity?.every((entry) => entry.workMs === null)).toBe(true);
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

describe("policy propagation", () => {
  it("recalculates the selected attempt and history with the same supplied policy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "timing-policy-"));
    temporaryRoots.push(root);
    const intents = path.join(root, "aidlc", "spaces", "default", "intents");
    const activeRecord = path.join(intents, "active");
    const historyRecord = path.join(intents, "history");
    const state = [
      "## Project Information",
      "- **State Version**: 8",
      "## Stage Progress",
      "### CONSTRUCTION PHASE",
      "- [-] code-generation — EXECUTE",
      "## Current Status",
      "- **Current Stage**: code-generation",
      "",
    ].join("\n");
    for (const record of [activeRecord, historyRecord]) {
      await mkdir(path.join(record, "audit"), { recursive: true });
      await writeFile(path.join(record, "aidlc-state.md"), state);
    }
    const block = (event: string, time: string) =>
      `**Event**: ${event}\n**Timestamp**: 2026-09-15T${time}:00Z\n**Stage**: code-generation\n`;
    await writeFile(
      path.join(activeRecord, "audit", "one.md"),
      [block("STAGE_STARTED", "10:00"), block("ARTIFACT_CREATED", "10:15")].join("\n---\n"),
    );
    await writeFile(
      path.join(historyRecord, "audit", "one.md"),
      [block("STAGE_STARTED", "09:00"), block("STAGE_COMPLETED", "09:15")].join("\n---\n"),
    );
    const now = Date.parse("2026-09-15T10:16:00Z");
    const reader = (gapMinutes: number) =>
      createReader(root, {
        recordDir: async () => ({ ok: true as const, value: activeRecord }),
        timingPolicy: { algorithmVersion: "session-gap-v2", gapThresholdMs: gapMinutes * 60_000 },
      });
    const twenty = expectOk(await reader(20).getTimings(now)).value;
    expect(twenty.policy).toEqual({
      algorithmVersion: "session-gap-v2",
      gapThresholdMs: 20 * 60_000,
    });
    expect(twenty.stageViews[0]).toMatchObject({
      elapsedActiveMs: 15 * 60_000,
      estimateMs: 15 * 60_000,
    });
    expect(twenty.estimateCoverage).toEqual({ known: 1, unknown: 0 });

    const ten = expectOk(await reader(10).getTimings(now)).value;
    expect(ten.stageViews[0]).toMatchObject({
      elapsedActiveMs: 0,
      estimateMs: null,
      sampleExcludedCount: 1,
    });
    expect(ten.estimateCoverage).toEqual({ known: 0, unknown: 1 });
    expect(ten.timings[0]?.runId).toBe(twenty.timings[0]?.runId);
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
