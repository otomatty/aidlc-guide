import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { routeRead } from "../src/handlers/read.ts";
import { createGuideService } from "../src/service.ts";

let root: string;
beforeEach(() => vi.stubEnv("AIDLC_DISABLE_USAGE_TRACKING", "0"));
afterEach(async () => {
  vi.unstubAllEnvs();
  if (root) await rm(root, { recursive: true, force: true });
});

it("serves installed model settings even before a workflow has an active intent", async () => {
  root = await mkdtemp(join(tmpdir(), "stage-model-api-"));
  await mkdir(join(root, ".claude/tools/data"), { recursive: true });
  await writeFile(
    join(root, ".claude/tools/data/stage-graph.json"),
    JSON.stringify([{ slug: "init", lead_agent: "orchestrator", mode: "inline" }]),
  );
  const service = createGuideService({ workspaceRoot: root });
  const result = await routeRead(service.readContext, new URL("http://localhost/api/stage-models"));
  expect(result?.status).toBe(200);
  expect(result?.body).toMatchObject({
    ok: true,
    value: {
      harnesses: [{ id: "claude", stages: [{ slug: "init", lead: { source: "session" } }] }],
      observed: {},
    },
  });
});

it("uses the selected record instead of the active cursor and never changes the ledger", async () => {
  root = await mkdtemp(join(tmpdir(), "stage-model-api-selection-"));
  const intents = join(root, "aidlc/spaces/default/intents");
  await mkdir(join(intents, "first"), { recursive: true });
  await mkdir(join(intents, "second"), { recursive: true });
  await writeFile(join(intents, "active-intent"), "first\n");
  await writeFile(
    join(intents, "intents.json"),
    JSON.stringify([
      { dirName: "first", uuid: "first-id" },
      { dirName: "second", uuid: "second-id" },
    ]),
  );
  const sessions = join(root, "aidlc/.aidlc-sessions");
  await mkdir(sessions, { recursive: true });
  const ledgerPath = join(sessions, "usage-ledger.json");
  const content = JSON.stringify({
    schemaVersion: 3,
    workflows: {
      "intent:first-id": {
        byStage: { "code-generation": { byModel: { first: { tokens: { input: 1 } } } } },
      },
      "intent:second-id": {
        byStage: { "code-generation": { byModel: { second: { tokens: { input: 1 } } } } },
      },
    },
  });
  await writeFile(ledgerPath, content);
  const service = createGuideService({ workspaceRoot: root, initialSelected: "second" });
  try {
    const url = new URL("http://localhost/api/stage-models");
    const selected = await routeRead(service.readContext, url);
    expect(selected?.body).toMatchObject({
      ok: true,
      value: { observed: { "code-generation": ["second"] } },
    });
    expect((await service.selectIntent("first")).status).toBe(200);
    const changed = await routeRead(service.readContext, url);
    expect(changed?.body).toMatchObject({
      ok: true,
      value: { observed: { "code-generation": ["first"] } },
    });
    vi.stubEnv("AIDLC_DISABLE_USAGE_TRACKING", "1");
    expect((await routeRead(service.readContext, url))?.body).toMatchObject({
      ok: true,
      value: { observed: {} },
    });
    expect(await readFile(ledgerPath, "utf8")).toBe(content);
    expect(await readFile(join(intents, "active-intent"), "utf8")).toBe("first\n");
  } finally {
    service.docsQa?.dispose();
  }
});
