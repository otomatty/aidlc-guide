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
