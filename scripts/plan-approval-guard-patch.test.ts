import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The guard's library imports bun:ffi, so the check runs in a Bun child.
const HARNESS = path.join(import.meta.dirname, "..", ".cursor");
const GUARD = path.join(HARNESS, "hooks", "aidlc-plan-approval-guard.ts");
const LIB = path.join(HARNESS, "tools", "aidlc-lib.ts");
const SCRIPT = `
const { onlyGateOpenedSince } = await import(${JSON.stringify(GUARD)});
const { stateDigest } = await import(${JSON.stringify(LIB)});
const { current, issued } = JSON.parse(await Bun.stdin.text());
process.stdout.write(String(onlyGateOpenedSince(current, "code-generation", stateDigest(issued))));
`;

function onlyGateOpened(current: string, issued: string): boolean {
  const result = spawnSync("bun", ["-e", SCRIPT], {
    input: JSON.stringify({ current, issued }),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout === "true";
}

function state(checkbox: string, fields: { updated: string; stage: string }): string {
  return [
    "# AI-DLC State",
    "",
    "## Current Status",
    `- **Current Stage**: ${fields.stage}`,
    `- **Last Updated**: ${fields.updated}`,
    "",
    "## Stage Progress",
    "- [x] functional-design — EXECUTE",
    `- [${checkbox}] code-generation — EXECUTE`,
    "- [ ] build-and-test — EXECUTE",
    "",
  ].join("\n");
}

const issued = state("-", { updated: "2026-09-25T00:00:00Z", stage: "code-generation" });

describe("onlyGateOpenedSince", () => {
  it("accepts a state whose only change is opening this stage's gate", () => {
    const opened = state("?", { updated: "2026-09-25T00:05:00Z", stage: "code-generation" });
    expect(onlyGateOpened(opened, issued)).toBe(true);
  });

  it("refuses when anything besides the gate opening changed", () => {
    const moved = state("?", { updated: "2026-09-25T00:05:00Z", stage: "build-and-test" });
    expect(onlyGateOpened(moved, issued)).toBe(false);
  });

  it("refuses while the stage is still in progress", () => {
    const running = state("-", { updated: "2026-09-25T00:05:00Z", stage: "build-and-test" });
    expect(onlyGateOpened(running, issued)).toBe(false);
  });

  it("refuses a completed stage even if the rest matches", () => {
    const done = state("x", { updated: "2026-09-25T00:05:00Z", stage: "code-generation" });
    expect(onlyGateOpened(done, issued)).toBe(false);
  });
});
