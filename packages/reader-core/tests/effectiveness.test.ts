import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deriveEffectiveness } from "../src/effectiveness/derive.ts";
import { parseMeasurementEvents, sortMeasurementEvents } from "../src/effectiveness/events.ts";
import { getEffectiveness } from "../src/effectiveness/read.ts";
import { auditUsageSummary, ledgerUsage, selectUsage } from "../src/effectiveness/usage.ts";

const BASE = Date.parse("2026-09-01T00:00:00Z");
function block(event: string, second: number, fields: Record<string, string> = {}): string {
  return [
    "---",
    `**Event**: ${event}`,
    `**Timestamp**: ${new Date(BASE + second * 1000).toISOString()}`,
    ...Object.entries(fields).map(([k, v]) => `**${k}**: ${v}`),
    "",
  ].join("\n");
}
function events(...blocks: string[]) {
  return sortMeasurementEvents(parseMeasurementEvents(blocks.join("\n"), "a.md").events);
}
const stage = { Stage: "code-generation" };
const reviewFields = { ...stage, Reviewer: "quality", Iteration: "1" };
const sensorFields = {
  "Stage slug": "build-and-test",
  "Sensor ID": "linter",
  "Fire id": "12345678",
};
const usageFields = {
  ...stage,
  "Tokens In": "100",
  "Tokens Out": "20",
  "Cache Read": "50",
  "Cache Write": "10",
  "Cost USD": "0.25",
};

describe("effectiveness evidence aggregation", () => {
  it("retains only measurement fields, removes standalone runs and accepts historical identical timestamps", () => {
    const text =
      block("STAGE_STARTED", 0, {
        ...stage,
        Feedback: "private",
        "User Input": "private",
        Timestamp: new Date(BASE).toISOString(),
      }) + block("STAGE_COMPLETED", 1, { ...stage, Workflow: "single-stage:code-generation" });
    const parsed = parseMeasurementEvents(text, "a");
    expect(parsed.events).toHaveLength(1);
    expect(JSON.stringify(parsed)).not.toContain("private");
    expect(parsed.warnings).toEqual([]);
  });
  it("rejects malformed/conflicting audit evidence with bounded warning categories", () => {
    const parsed = parseMeasurementEvents(
      block("STAGE_STARTED", 0, { Timestamp: "invalid" }) +
        "\n**Event**: WORKFLOW_COMPLETED\n**Timestamp**: broken",
      "bad",
    );
    expect(parsed.warnings.length).toBeGreaterThan(0);
    expect(parsed.events).toHaveLength(0);
    const conflicting = parseMeasurementEvents(
      block("STAGE_STARTED", 0, { Timestamp: new Date(BASE + 1000).toISOString() }),
      "one-block",
    );
    expect(conflicting.events).toHaveLength(0);
    expect(conflicting.warnings.join(" ")).toContain("conflicting audit field");
  });
  it("calculates complete lead time and excludes missing evidence from measured zeros", () => {
    const row = deriveEffectiveness(
      events(block("WORKFLOW_STARTED", 0), block("WORKFLOW_COMPLETED", 100)),
      BASE + 200_000,
    );
    expect(row.completionMs).toBe(100_000);
    expect(row.elapsedMs).toBe(100_000);
    expect(row.approvalWait).toBeNull();
    expect(row.rejections).toBeNull();
    expect(row.humanTurns).toBeNull();
    expect(row.reviews).toBeNull();
    expect(row.sensors).toBeNull();
    expect(deriveEffectiveness([], BASE).elapsedMs).toBeNull();
  });
  it("unions overlapping unit waits and preserves opening across revalidation", () => {
    const row = deriveEffectiveness(
      events(
        block("STAGE_AWAITING_APPROVAL", 0, { ...stage, Unit: "a" }),
        block("STAGE_AWAITING_APPROVAL", 10, { ...stage, Unit: "b" }),
        block("STAGE_AWAITING_APPROVAL", 20, { ...stage, Unit: "a", Revalidated: "true" }),
        block("GATE_APPROVED", 30, { ...stage, Unit: "a" }),
        block("GATE_REJECTED", 40, { ...stage, Unit: "b" }),
        block("STAGE_REVISING", 40, { ...stage, Unit: "b" }),
        block("STAGE_AWAITING_APPROVAL", 50, { ...stage, Unit: "b" }),
      ),
      BASE + 60_000,
    );
    expect(row.approvalWait).toEqual({
      completedMs: 40_000,
      pendingMs: 10_000,
      completedIntervals: 2,
      pendingIntervals: 1,
      excludedIntervals: 0,
    });
    expect(row.rejections).toBe(1);
    expect(row.revisions).toBe(1);
  });
  it("excludes recovered, ambiguous, skipped and jumped gate intervals", () => {
    const parsed = events(
      block("STAGE_AWAITING_APPROVAL", 0, { ...stage, Recovered: "true" }),
      block("GATE_APPROVED", 1, stage),
      block("STAGE_AWAITING_APPROVAL", 2, stage),
      block("STAGE_JUMPED", 3, { Target: "build-and-test" }),
      block("STAGE_AWAITING_APPROVAL", 4, stage),
      block("STAGE_SKIPPED", 5, stage),
    );
    const row = deriveEffectiveness(parsed, BASE + 10_000);
    expect(row.approvalWait?.pendingIntervals).toBe(0);
    expect(row.approvalWait?.excludedIntervals).toBeGreaterThan(0);
    const tied = [
      ...parseMeasurementEvents(block("STAGE_AWAITING_APPROVAL", 0, stage), "a").events,
      ...parseMeasurementEvents(block("GATE_APPROVED", 0, stage), "b").events,
    ];
    expect(deriveEffectiveness(tied, BASE + 1000).approvalWait?.completedIntervals).toBe(0);
  });
  it("measures paired first reviews separately from later review iterations", () => {
    const row = deriveEffectiveness(
      events(
        block("REVIEW_REQUESTED", 0, { ...reviewFields, "Artifact Fingerprint": "sha256:a" }),
        block("REVIEW_COMPLETED", 1, {
          ...reviewFields,
          Verdict: "NOT-READY",
          "Request Fingerprint": "sha256:a",
        }),
        block("REVIEW_REQUESTED", 2, { ...reviewFields, Iteration: "2" }),
        block("REVIEW_COMPLETED", 3, { ...reviewFields, Iteration: "2", Verdict: "READY" }),
        block("REVIEW_COMPLETED", 4, { ...reviewFields, Iteration: "2", Verdict: "READY" }),
      ),
      BASE + 10_000,
    );
    expect(row.reviews).toMatchObject({
      completed: 2,
      firstPassTotal: 1,
      firstPassReady: 0,
      firstPassRate: 0,
    });
  });
  it("keeps independent unit reviews valid when another unit revises, and resets all bundled gate stages", () => {
    const row = deriveEffectiveness(
      events(
        block("REVIEW_REQUESTED", 0, { ...reviewFields, Unit: "b" }),
        block("GATE_REJECTED", 1, { ...stage, Unit: "a" }),
        block("REVIEW_COMPLETED", 2, { ...reviewFields, Unit: "b", Verdict: "READY" }),
        block("GATE_REJECTED", 3, {
          Stage: "functional-design",
          Unit: "b",
          "Gate Stages": "functional-design,code-generation",
        }),
        block("REVIEW_REQUESTED", 4, { ...reviewFields, Unit: "b" }),
        block("REVIEW_COMPLETED", 5, { ...reviewFields, Unit: "b", Verdict: "READY" }),
        block("BOLT_STARTED", 6, { "Bolt names": "b" }),
        block("REVIEW_REQUESTED", 7, { ...reviewFields, Unit: "b" }),
        block("REVIEW_COMPLETED", 8, { ...reviewFields, Unit: "b", Verdict: "NOT-READY" }),
      ),
      BASE + 10_000,
    );
    expect(row.reviews).toMatchObject({ completed: 3, firstPassTotal: 3, firstPassReady: 2 });
  });
  it("rejects stale review fingerprints and orphan review completions", () => {
    const row = deriveEffectiveness(
      events(
        block("REVIEW_REQUESTED", 0, { ...reviewFields, "Artifact Fingerprint": "a" }),
        block("REVIEW_COMPLETED", 1, {
          ...reviewFields,
          Verdict: "READY",
          "Request Fingerprint": "b",
        }),
        block("STAGE_JUMPED", 2, { Target: "other" }),
        block("REVIEW_COMPLETED", 3, {
          ...reviewFields,
          Verdict: "READY",
          "Request Fingerprint": "a",
        }),
      ),
      BASE + 10_000,
    );
    expect(row.reviews?.firstPassRate).toBeNull();
    expect(row.reviews?.unmatched).toBeGreaterThan(0);
  });
  it("pairs interleaved sensor firings by identity and distinguishes verification from unavailable tools", () => {
    const rows: string[] = [];
    for (let i = 0; i < 5; i++)
      rows.push(block("SENSOR_FIRED", i, { ...sensorFields, "Fire id": `fire-${i}` }));
    rows.push(
      block("SENSOR_PASSED", 10, {
        ...sensorFields,
        "Fire id": "fire-1",
        Note: "tool-unavailable",
      }),
    );
    rows.push(block("SENSOR_PASSED", 11, { ...sensorFields, "Fire id": "fire-0" }));
    rows.push(
      block("SENSOR_FAILED", 12, { ...sensorFields, "Fire id": "fire-2", "Findings count": "3" }),
    );
    rows.push(block("SENSOR_BUDGET_OVERRIDE", 13, { ...sensorFields, "Fire id": "fire-3" }));
    const row = deriveEffectiveness(events(...rows), BASE + 20_000);
    expect(row.sensors).toEqual({
      verifiedPassed: 1,
      failed: 1,
      skipped: 2,
      incomplete: 1,
      findings: 3,
    });
  });
  it("never adds repeated stage cumulative usage snapshots or workflow totals together", () => {
    const rows = events(
      block("STAGE_COMPLETED", 0, usageFields),
      block("STAGE_COMPLETED", 1, { ...usageFields, "Tokens In": "200" }),
    );
    expect(auditUsageSummary(rows, [])).toMatchObject({
      inputTokens: 200,
      source: "audit-stages",
      partial: true,
    });
    rows.push(
      ...events(
        block("WORKFLOW_COMPLETED", 2, {
          ...usageFields,
          "Tokens In": "500",
          "By Model": "future=null;known=0.25",
        }),
      ),
    );
    expect(auditUsageSummary(rows, [])).toMatchObject({
      inputTokens: 500,
      source: "audit-workflow",
      partial: true,
      unknownModels: ["future"],
    });
  });
});

function totals(input: number, usd: number) {
  return { tokens: { input, output: 2, cacheRead: 3, cacheCreate5m: 4, cacheCreate1h: 5 }, usd };
}
function ledger() {
  return {
    schemaVersion: 3,
    cursors: { "/private/transcript": { byteOffset: 100 } },
    totals: totals(99999, 900),
    workflows: {
      "intent:abc": {
        totals: totals(50, 1),
        byModel: { known: totals(40, 1), future: totals(10, 0) },
        sessions: { "/private/session": {} },
      },
    },
  };
}
describe("usage ownership", () => {
  it("prefers a more complete workflow snapshot over a stale local ledger without adding them", () => {
    const local = ledgerUsage(ledger(), "default", "work", "abc", new Set(["known"]), []);
    const audit = auditUsageSummary(
      events(
        block("WORKFLOW_COMPLETED", 0, { ...usageFields, "Tokens In": "1000", "Cost USD": "10" }),
      ),
      [],
    );
    expect(selectUsage(local, audit, [])).toMatchObject({
      inputTokens: 1000,
      estimatedUsd: 10,
      source: "audit-workflow",
    });
    if (!audit) throw new Error("fixture usage missing");
    expect(selectUsage(local, { ...audit, outputTokens: 0 }, [])).toMatchObject({
      inputTokens: 50,
      partial: true,
      source: "claude-ledger",
    });
  });
  it("reads only the selected intent, with unknown pricing and no transcript identifiers", () => {
    const row = ledgerUsage(ledger(), "default", "work", "abc", new Set(["known"]), []);
    expect(row).toMatchObject({
      source: "claude-ledger",
      inputTokens: 50,
      estimatedUsd: 1,
      partial: true,
      unknownModels: ["future"],
    });
    expect(JSON.stringify(row)).not.toContain("private");
    expect(ledgerUsage(ledger(), "default", "other", "other", new Set(), [])).toBeNull();
  });
  it("rejects old ledger semantics and malformed counts", () => {
    const old = ledger();
    old.schemaVersion = 2;
    expect(ledgerUsage(old, "default", "work", "abc", new Set(), [])).toBeNull();
    const malformed = ledger();
    malformed.workflows["intent:abc"].totals.tokens.input = -1;
    expect(ledgerUsage(malformed, "default", "work", "abc", new Set(), [])).toBeNull();
    const badCursors = { ...ledger(), cursors: { main: { lastUuid: "a" } } };
    expect(ledgerUsage(badCursors, "default", "work", "abc", new Set(), [])).toBeNull();
  });
});

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "aidlc-effectiveness-"));
  roots.push(root);
  const record = path.join(root, "aidlc/spaces/default/intents/work.one");
  await mkdir(path.join(record, "audit"), { recursive: true });
  const golden = await readFile(
    new URL("./fixtures/golden/aidlc-state.md", import.meta.url),
    "utf8",
  );
  await writeFile(
    path.join(record, "aidlc-state.md"),
    golden.replace(/\*\*Status\*\*: [^\r\n]+/, "**Status**: Completed"),
  );
  await writeFile(
    path.join(record, "audit/a.md"),
    block("WORKFLOW_STARTED", 0) + block("WORKFLOW_COMPLETED", 10),
  );
  return { root, record };
}
describe("effectiveness reader boundaries", () => {
  it("reads all active-space intents with dotted directory names and state lifecycle status", async () => {
    const { root } = await workspace();
    const result = await getEffectiveness(root, BASE + 20_000);
    expect("ok" in result && result.value.intents[0]).toMatchObject({
      dirName: "work.one",
      scope: "prd-implementation",
      depth: "Standard",
      status: "Completed",
      completionMs: 10_000,
    });
  });
  it("rejects active-space traversal before scanning", async () => {
    const { root } = await workspace();
    await writeFile(path.join(root, "aidlc/active-space"), "../../outside");
    expect(await getEffectiveness(root)).toEqual({ error: true, reason: "outside-record" });
  });
  it("does not keep a terminal workflow clock running when the completion receipt is missing", async () => {
    const { root, record } = await workspace();
    await writeFile(path.join(record, "audit/a.md"), block("WORKFLOW_STARTED", 0));
    const result = await getEffectiveness(root, BASE + 100_000);
    expect("ok" in result && result.value.intents[0]).toMatchObject({
      status: "Completed",
      elapsedMs: null,
      completionMs: null,
    });
    expect("ok" in result && result.value.intents[0]?.warnings.join(" ")).toContain(
      "completion boundary",
    );
  });
  it("does not derive measurements for unsupported state versions", async () => {
    const { root, record } = await workspace();
    const original = await readFile(path.join(record, "aidlc-state.md"), "utf8");
    await writeFile(
      path.join(record, "aidlc-state.md"),
      original.replace("**State Version**: 8", "**State Version**: 999"),
    );
    const result = await getEffectiveness(root);
    expect("ok" in result && result.value.intents[0]).toMatchObject({
      completionMs: null,
      usage: null,
      reviews: null,
    });
    expect("ok" in result && result.value.intents[0]?.warnings.join(" ")).toContain("unsupported");
  });
  it("rejects audit junctions into a different record within the workspace", async () => {
    const { root, record } = await workspace();
    const other = path.join(root, "other-audit");
    await mkdir(other);
    await writeFile(path.join(other, "b.md"), block("HUMAN_TURN", 20));
    await rm(path.join(record, "audit"), { recursive: true });
    await symlink(other, path.join(record, "audit"), "junction");
    const result = await getEffectiveness(root);
    expect("ok" in result && result.value.intents[0]?.humanTurns).toBeNull();
    expect("ok" in result && result.value.intents[0]?.warnings.join(" ")).toContain(
      "outside-record",
    );
  });
  it("reports malformed and oversized inputs while retaining other measurements", async () => {
    const { root, record } = await workspace();
    await writeFile(path.join(root, "aidlc/spaces/default/intents/intents.json"), "invalid");
    await writeFile(path.join(record, "audit/huge.md"), "x".repeat(4 * 1024 * 1024 + 1));
    const result = await getEffectiveness(root, BASE + 20_000);
    expect("ok" in result && result.value.intents[0]?.completionMs).toBe(10_000);
    expect("ok" in result && result.value.warnings.join(" ")).toContain("invalid JSON");
    expect("ok" in result && result.value.intents[0]?.warnings.join(" ")).toContain("too-large");
  });
});
