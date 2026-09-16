import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const adapterUrl = new URL("./aidlc-cursor-adapter.ts", import.meta.url).href;
const fixtureRoots: string[] = [];

function workspace(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  fixtureRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function inspectWorkflow(root: string): { recordDir: string | null; enforcementActive: boolean } {
  // The adapter and its upstream dependencies run in Bun, while Vitest runs in Node.
  const script = `
    import { resolveActiveRecordDir, workflowEnforcementActive } from ${JSON.stringify(adapterUrl)};
    const root = ${JSON.stringify(root)};
    console.log(JSON.stringify({
      recordDir: resolveActiveRecordDir(root),
      enforcementActive: workflowEnforcementActive(root),
    }));
  `;
  const result = spawnSync("bun", ["--eval", script], {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: 5_000,
  });
  expect(
    result.status,
    `Bun adapter inspection failed: ${result.error?.message ?? result.signal ?? result.status}\n${result.stderr}`,
  ).toBe(0);
  return JSON.parse(result.stdout);
}

function seedRecord(
  root: string,
  slug: string,
  status: string | null,
  options: { cursor?: boolean; space?: string } = {},
): string {
  const space = options.space ?? "default";
  const intents = path.join(root, "aidlc", "spaces", space, "intents");
  const record = path.join(intents, slug);
  mkdirSync(record, { recursive: true });
  const statusLine = status === null ? "" : `- **Status**: ${status}\n`;
  writeFileSync(path.join(record, "aidlc-state.md"), `## Current Status\n${statusLine}`, "utf-8");
  if (options.cursor !== false) {
    writeFileSync(path.join(intents, "active-intent"), `${slug}\n`, "utf-8");
  }
  return record;
}

describe("workflowEnforcementActive", () => {
  it("is off when the workspace has no aidlc record", () => {
    const root = workspace("aidlc-guard-none-");
    const result = inspectWorkflow(root);
    expect(result.recordDir).toBeNull();
    expect(result.enforcementActive).toBe(false);
  });

  it("is off when the active workflow is Completed", () => {
    const root = workspace("aidlc-guard-done-");
    seedRecord(root, "260720-done", "Completed");
    expect(inspectWorkflow(root).enforcementActive).toBe(false);
  });

  it("is on when the active workflow is Running", () => {
    const root = workspace("aidlc-guard-run-");
    seedRecord(root, "260720-run", "Running");
    expect(inspectWorkflow(root).enforcementActive).toBe(true);
  });

  it("is on when Status is missing (cannot tell it is finished)", () => {
    const root = workspace("aidlc-guard-unk-");
    seedRecord(root, "260720-unk", null);
    expect(inspectWorkflow(root).enforcementActive).toBe(true);
  });

  it("is on when the state file exists but cannot be read", () => {
    const root = workspace("aidlc-guard-io-");
    const record = seedRecord(root, "260720-io", "Running");
    const state = path.join(record, "aidlc-state.md");
    rmSync(state);
    mkdirSync(state);
    expect(inspectWorkflow(root).enforcementActive).toBe(true);
  });

  it("uses the lone intent when the cursor is absent", () => {
    const root = workspace("aidlc-guard-lone-");
    seedRecord(root, "260720-lone", "Running", { cursor: false });
    const result = inspectWorkflow(root);
    expect(path.basename(result.recordDir ?? "")).toBe("260720-lone");
    expect(result.enforcementActive).toBe(true);
  });

  it("does not guess when two intents exist and the cursor is absent", () => {
    const root = workspace("aidlc-guard-two-");
    seedRecord(root, "260720-a", "Running", { cursor: false });
    seedRecord(root, "260720-b", "Running", { cursor: false });
    const result = inspectWorkflow(root);
    expect(result.recordDir).toBeNull();
    expect(result.enforcementActive).toBe(false);
  });
});
