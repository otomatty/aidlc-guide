import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { routeRead } from "../src/handlers/read.ts";
import { createGuideService } from "../src/service.ts";

const STATE_MD = `# AI-DLC State Tracking

## Project Information
- **Project**: view-pin test
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
  const root = await mkdtemp(path.join(tmpdir(), "view-pin-"));
  const intents = path.join(root, "aidlc", "spaces", "default", "intents");
  for (const name of names) {
    const dir = path.join(intents, name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "aidlc-state.md"), STATE_MD);
  }
  return root;
}

describe("GuideService view pin", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("returns no-selected-intent when several records and no pin", async () => {
    const root = await seedRecords(["a-intent", "b-intent"]);
    roots.push(root);
    const service = createGuideService({ workspaceRoot: root });
    expect(await service.readContext.recordDir()).toEqual({
      error: true,
      reason: "no-selected-intent",
    });
  });

  it("overlays selected: null on GET /api/intents when unpinned", async () => {
    const root = await seedRecords(["a-intent", "b-intent"]);
    roots.push(root);
    const service = createGuideService({ workspaceRoot: root });
    const result = await routeRead(service.readContext, new URL("http://x/api/intents"));
    expect(result?.status).toBe(200);
    expect(result?.body).toEqual({
      ok: true,
      value: {
        space: "default",
        active: null,
        all: ["a-intent", "b-intent"],
        selected: null,
      },
    });
  });

  it("uses initialSelected when it is listed", async () => {
    const root = await seedRecords(["a-intent", "b-intent"]);
    roots.push(root);
    const service = createGuideService({ workspaceRoot: root, initialSelected: "b-intent" });
    const record = await service.readContext.recordDir();
    expect(record).toEqual({
      ok: true,
      value: path.join(root, "aidlc", "spaces", "default", "intents", "b-intent"),
    });
    const listed = await routeRead(service.readContext, new URL("http://x/api/intents"));
    expect(listed?.body).toMatchObject({ ok: true, value: { selected: "b-intent" } });
  });

  it("elects a lone record without a cursor", async () => {
    const root = await seedRecords(["only-intent"]);
    roots.push(root);
    const service = createGuideService({ workspaceRoot: root });
    const record = await service.readContext.recordDir();
    expect(record).toEqual({
      ok: true,
      value: path.join(root, "aidlc", "spaces", "default", "intents", "only-intent"),
    });
  });

  it("returns no-active-intent when there are no records", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "view-pin-empty-"));
    roots.push(root);
    await mkdir(path.join(root, "aidlc", "spaces", "default", "intents"), { recursive: true });
    const service = createGuideService({ workspaceRoot: root });
    expect(await service.readContext.recordDir()).toEqual({
      error: true,
      reason: "no-active-intent",
    });
  });
});
