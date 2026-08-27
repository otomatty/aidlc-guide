import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "../src/doctor.ts";

const STATE_MD = `# AI-DLC State Tracking

## Project Information
- **Project**: doctor test
- **Project Type**: Greenfield
- **Scope**: feature
- **State Version**: 8

## Scope Configuration
- **Depth**: Standard
- **Test Strategy**: Standard

## Execution Plan Summary
- **Total Stages**: 1
- **Completed**: 0

## Stage Progress

### IDEATION PHASE
- [ ] intent-capture — EXECUTE

## Current Status
- **Lifecycle Phase**: IDEATION
- **Current Stage**: intent-capture
- **Next Stage**: intent-capture
`;

async function seedRecords(names: string[]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doctor-"));
  const intents = path.join(root, "aidlc", "spaces", "default", "intents");
  await mkdir(intents, { recursive: true });
  for (const name of names) {
    const dir = path.join(intents, name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "aidlc-state.md"), STATE_MD);
  }
  return root;
}

describe("runDoctor intent check", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("fails when aidlc/ is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "doctor-no-aidlc-"));
    roots.push(root);
    const report = await runDoctor(root);
    const intent = report.checks.find((c) => c.id === "intent");
    expect(intent?.ok).toBe(false);
    expect(intent?.detail).toContain("aidlc/");
    expect(report.ready).toBe(false);
  });

  it("fails when no intent records exist", async () => {
    const root = await seedRecords([]);
    roots.push(root);
    const report = await runDoctor(root);
    const intent = report.checks.find((c) => c.id === "intent");
    expect(intent?.ok).toBe(false);
    expect(intent?.detail).toContain("まだありません");
    expect(report.ready).toBe(false);
  });

  it("is ok with one record and no active-intent cursor", async () => {
    const root = await seedRecords(["only-intent"]);
    roots.push(root);
    const report = await runDoctor(root);
    const intent = report.checks.find((c) => c.id === "intent");
    expect(intent?.ok).toBe(true);
    expect(intent?.detail).toContain("1 件");
    expect(report.ready).toBe(true);
  });

  it("is ok with several records and no active-intent cursor", async () => {
    const root = await seedRecords(["a-intent", "b-intent"]);
    roots.push(root);
    const report = await runDoctor(root);
    const intent = report.checks.find((c) => c.id === "intent");
    expect(intent?.ok).toBe(true);
    expect(intent?.detail).toContain("2 件");
    expect(intent?.detail).not.toContain("active-intent");
    expect(intent?.detail).not.toContain("/aidlc intent");
    expect(report.ready).toBe(true);
  });
});

describe("runDoctor workflows-version", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function pinRoot(version: string): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "doctor-pin-"));
    roots.push(root);
    const docs = path.join(root, "docs");
    await mkdir(docs, { recursive: true });
    await writeFile(
      path.join(docs, "official-docs.manifest.json"),
      JSON.stringify({
        sourceVersion: version,
        source: "aidlc-workflows",
        capturedAt: "2026-08-01T00:00:00Z",
      }),
    );
    return root;
  }

  it("does not add a row when the workspace has no AIDLC_VERSION", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "doctor-no-ver-"));
    roots.push(workspace);
    const report = await runDoctor(workspace, await pinRoot("2.6.99"));
    expect(report.checks.find((c) => c.id === "workflows-version")).toBeUndefined();
  });

  it("flags a workspace older than the Guide pin", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "doctor-old-"));
    roots.push(workspace);
    await mkdir(path.join(workspace, ".cursor", "tools"), { recursive: true });
    await writeFile(
      path.join(workspace, ".cursor", "tools", "aidlc-version.ts"),
      'export const AIDLC_VERSION = "2.5.0";\n',
    );
    const report = await runDoctor(workspace, await pinRoot("2.6.99"));
    const row = report.checks.find((c) => c.id === "workflows-version");
    expect(row?.ok).toBe(false);
    expect(row?.detail).toContain("2.5.0");
    expect(row?.detail).toContain("2.6.99");
  });

  it("is ok when the workspace is at or above the pin", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "doctor-current-"));
    roots.push(workspace);
    await mkdir(path.join(workspace, ".cursor", "tools"), { recursive: true });
    await writeFile(
      path.join(workspace, ".cursor", "tools", "aidlc-version.ts"),
      'export const AIDLC_VERSION = "2.6.99";\n',
    );
    const report = await runDoctor(workspace, await pinRoot("2.6.99"));
    const row = report.checks.find((c) => c.id === "workflows-version");
    expect(row?.ok).toBe(true);
    expect(row?.detail).toContain("2.6.99");
  });

  it("flags an unparseable AIDLC_VERSION without offering an update", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "doctor-bad-"));
    roots.push(workspace);
    await mkdir(path.join(workspace, ".claude", "tools"), { recursive: true });
    await writeFile(
      path.join(workspace, ".claude", "tools", "aidlc-version.ts"),
      "export const AIDLC_VERSION = 'dev';\n",
    );
    const report = await runDoctor(workspace, await pinRoot("2.6.99"));
    const row = report.checks.find((c) => c.id === "workflows-version");
    expect(row?.ok).toBe(false);
    expect(row?.detail).toContain("解釈できません");
  });
});
