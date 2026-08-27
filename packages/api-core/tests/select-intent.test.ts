import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { routeSelectIntent } from "../src/handlers/select-intent.ts";
import { createGuideService } from "../src/service.ts";

const STATE_MD = `# AI-DLC State Tracking

## Project Information
- **Project**: select-intent test
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
  const root = await mkdtemp(path.join(tmpdir(), "select-intent-"));
  const intents = path.join(root, "aidlc", "spaces", "default", "intents");
  for (const name of names) {
    const dir = path.join(intents, name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "aidlc-state.md"), STATE_MD);
  }
  return root;
}

describe("POST /api/select-intent", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("pins a listed intent and does not write active-intent", async () => {
    const root = await seedRecords(["a-intent", "b-intent"]);
    roots.push(root);
    const persisted: string[] = [];
    const service = createGuideService({
      workspaceRoot: root,
      onSelect: (slug) => {
        persisted.push(slug ?? "");
      },
    });
    const result = await routeSelectIntent(service, { intent: "b-intent" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      value: {
        space: "default",
        active: null,
        all: ["a-intent", "b-intent"],
        selected: "b-intent",
      },
    });
    expect(await service.readContext.recordDir()).toEqual({
      ok: true,
      value: path.join(root, "aidlc", "spaces", "default", "intents", "b-intent"),
    });
    expect(persisted).toEqual(["b-intent"]);
    expect(
      existsSync(path.join(root, "aidlc", "spaces", "default", "intents", "active-intent")),
    ).toBe(false);
  });

  it("rejects an unknown name", async () => {
    const root = await seedRecords(["a-intent", "b-intent"]);
    roots.push(root);
    const service = createGuideService({ workspaceRoot: root });
    const result = await routeSelectIntent(service, { intent: "missing" });
    expect(result.status).toBe(400);
    expect(await service.readContext.recordDir()).toEqual({
      error: true,
      reason: "no-selected-intent",
    });
  });

  it("rejects parent hops and path separators", async () => {
    const root = await seedRecords(["a-intent"]);
    roots.push(root);
    const service = createGuideService({ workspaceRoot: root });
    expect(await routeSelectIntent(service, { intent: ".." })).toMatchObject({ status: 400 });
    expect(await routeSelectIntent(service, { intent: "../a-intent" })).toMatchObject({
      status: 400,
    });
    expect(await routeSelectIntent(service, { intent: "a-intent/../a-intent" })).toMatchObject({
      status: 400,
    });
  });

  it("refuses hostMode", async () => {
    const root = await seedRecords(["a-intent", "b-intent"]);
    roots.push(root);
    const service = createGuideService({ workspaceRoot: root, hostMode: true });
    const result = await routeSelectIntent(service, { intent: "a-intent" });
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: "read-only-mode" });
  });
});
