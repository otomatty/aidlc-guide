import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CustomizationEngine, EngineAction, EngineRequest } from "../src/customization/engine-adapter.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handlePost, routePost } from "../src/handlers/post.ts";
import { routeRead } from "../src/handlers/read.ts";
import { createGuideService } from "../src/service.ts";

let root: string;
const stops: Array<() => void> = [];
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "guide-spaces-"));
  const state = await readFile(new URL("../../reader-core/tests/fixtures/golden/aidlc-state.md", import.meta.url), "utf8");
  for (const space of ["default", "team-b"]) {
    const record = path.join(root, "aidlc/spaces", space, "intents/shared");
    await mkdir(path.join(record, "construction", `unit-${space}`), { recursive: true });
    await writeFile(path.join(record, "aidlc-state.md"), state);
  }
  await mkdir(path.join(root, "aidlc/spaces/empty/intents"), { recursive: true });
});
afterEach(async () => {
  for (const stop of stops.splice(0)) stop();
  await rm(root, { recursive: true, force: true });
});
function fixture(config = {}) {
  const engine = {
    harnesses: async () => [{ id: ".cursor", label: "Cursor" }],
    switch: vi.fn(async (space: string) => {
      await writeFile(path.join(root, "aidlc/active-space"), space);
    }),
  };
  const service = createGuideService({ workspaceRoot: root, spaceEngine: engine, versionGate: null, ...config });
  const messages: object[] = [];
  service.hub.add({ send: (data) => messages.push(JSON.parse(data)) });
  return { service, engine, messages };
}
const get = (service: ReturnType<typeof createGuideService>, route: string) =>
  routeRead(service.readContext, new URL(`http://localhost${route}`));
const change = (service: ReturnType<typeof createGuideService>, space = "team-b", expectedSpace = "default") =>
  routePost(service, "/api/switch-space", { space, expectedSpace, harness: ".cursor" });

describe("space selection", () => {
  it.each(["catalog", "validate", "plan", "recover"] as const)("refuses a switch from another host during customization %s", async (pauseAt) => {
    let entered = () => {};
    let release = () => {};
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const customizationEngine: CustomizationEngine = {
      async call<T>(action: EngineAction, _request: EngineRequest): Promise<T> {
        if (action === pauseAt) { entered(); await paused; }
        if (action === "catalog") return { spaceId: "default", configurationRevision: "base", items: [] } as T;
        if (action === "validate") return { valid: true, diagnostics: [] } as T;
        if (action === "plan") return { id: "plan-1", configurationRevision: "base", canApply: true, diagnostics: [], files: [] } as T;
        if (action === "apply") {
          if (pauseAt === "recover") throw new Error("interrupted apply");
          return { status: "committed", configurationRevision: "saved" } as T;
        }
        if (action === "recover") return { status: "committed", configurationRevision: "saved" } as T;
        throw new Error(`unexpected ${action}`);
      },
    };
    const saving = fixture({ customizationEngine });
    const switching = fixture();
    const request = { requestId: "save-1", spaceId: "default", expectedConfigurationRevision: "base", changes: [] };
    let pending;
    if (pauseAt === "recover") {
      const operation = await saving.service.customization!.save(request);
      pending = saving.service.customization!.recover({ operationId: operation.id });
    } else pending = saving.service.customization!.save(request);
    try {
      await started;
      if (pauseAt !== "recover") expect(await saving.service.customization!.activeOperation()).toBeNull();
      expect(await change(switching.service)).toMatchObject({ status: 409, body: { reason: "customization-busy" } });
      expect(switching.engine.switch).not.toHaveBeenCalled();
    } finally { release(); await pending; }
    expect(await change(switching.service)).toMatchObject({ status: 200 });
  });
  it("rejects names normalized by the utility before moving the cursor", async () => {
    const names = ["Team.B", "team_b", "team--b", "team-b-", "1team", "help", "a".repeat(49)];
    for (const name of names) await mkdir(path.join(root, "aidlc/spaces", name));
    const { service, engine } = fixture();
    expect((await get(service, "/api/spaces"))?.body).toMatchObject({ value: { spaces: ["default", "empty", "team-b"] } });
    for (const name of names) expect(await change(service, name)).toMatchObject({ status: 400 });
    expect(engine.switch).not.toHaveBeenCalled();
    expect((await get(service, "/api/intents"))?.body).toMatchObject({ value: { space: "default" } });
  });
  it("stamps workflow, matrix and timings with the record used by each read", async () => {
    const { service } = fixture();
    expect(await service.reader.getWorkflow()).toMatchObject({ value: { record: { space: "default", intent: "shared" } } });
    expect(await service.reader.getMatrix()).toMatchObject({ value: { record: { space: "default", intent: "shared" } } });
    expect(await change(service)).toMatchObject({ status: 200 });
    expect(await service.reader.getWorkflow()).toMatchObject({ value: { record: { space: "team-b", intent: "shared" } } });
    expect(await service.reader.getMatrix()).toMatchObject({ value: { record: { space: "team-b", intent: "shared" } } });
    expect(await service.reader.getTimings()).toMatchObject({ value: { space: "team-b", intent: "shared" } });
  });
  it("rejects cross-site HTTP writes and oversized JSON before calling the engine", async () => {
    const { service, engine } = fixture();
    const request = new Request("http://localhost/api/switch-space", { method: "POST", headers: { origin: "https://example.com" }, body: "{}" });
    expect((await handlePost(service, "/api/switch-space", request))?.status).toBe(403);
    const oversized = new Request("http://localhost/api/switch-space", { method: "POST", body: JSON.stringify({ padding: "x".repeat(5000) }) });
    expect((await handlePost(service, "/api/switch-space", oversized))?.status).toBe(400);
    expect(engine.switch).not.toHaveBeenCalled();
  });
  it("restores a persisted pin only in the space it belongs to", async () => {
    await mkdir(path.join(root, "aidlc/spaces/default/intents/other"));
    const { service } = fixture({ initialSelected: "other", initialSelection: { space: "team-b", intent: "shared" } });
    expect((await get(service, "/api/intents"))?.body).toMatchObject({ value: { selected: null } });
    expect(await change(service)).toMatchObject({ body: { value: { selected: "shared" } } });
  });
  it.each(["default", "team-b"])("migrates a legacy pin into the initially active space %s only", async (space) => {
    for (const name of ["default", "team-b"]) await mkdir(path.join(root, "aidlc/spaces", name, "intents/other"));
    await writeFile(path.join(root, "aidlc/active-space"), space);
    const onSelection = vi.fn();
    const { service } = fixture({ initialSelected: "shared", onSelection });
    expect((await get(service, "/api/intents"))?.body).toMatchObject({ value: { space, selected: "shared" } });
    expect(onSelection).toHaveBeenCalledWith({ space, intent: "shared" });
    const otherSpace = space === "default" ? "team-b" : "default";
    expect(await change(service, otherSpace, space)).toMatchObject({ body: { value: { space: otherSpace, selected: null } } });
    expect(await change(service, space, otherSpace)).toMatchObject({ body: { value: { space, selected: "shared" } } });
  });
  it("refreshes the display even when the utility fails after moving the cursor", async () => {
    const { service, engine, messages } = fixture();
    await get(service, "/api/intents");
    engine.switch.mockImplementation(async () => {
      await writeFile(path.join(root, "aidlc/active-space"), "team-b");
      throw new Error("partial failure");
    });
    expect(await change(service)).toMatchObject({ status: 409 });
    expect(messages).toContainEqual({ type: "space-selected", space: "team-b", intent: "shared" });
    expect((await get(service, "/api/intents"))?.body).toMatchObject({ value: { space: "team-b" } });
  });
  it("serializes competing switches and rejects the stale request", async () => {
    const { service, engine } = fixture();
    const results = await Promise.all([change(service), change(service, "empty")]);
    expect(results.map((result) => result?.status)).toEqual([200, 409]);
    expect(engine.switch).toHaveBeenCalledTimes(1);
  });
  it("rejects a stale intent selection after another host switches spaces", async () => {
    for (const space of ["default", "team-b"]) await mkdir(path.join(root, "aidlc/spaces", space, "intents/other"));
    const viewing = fixture({ initialSelected: "shared" });
    const switching = fixture();
    expect((await get(viewing.service, "/api/intents"))?.body).toMatchObject({ value: { space: "default", selected: "shared" } });
    expect(await change(switching.service)).toMatchObject({ status: 200 });
    const request = { intent: "shared", expectedSpace: "default" };
    expect(await routePost(viewing.service, "/api/select-intent", request)).toMatchObject({ status: 409, body: { reason: "space-conflict" } });
    const http = await handlePost(viewing.service, "/api/select-intent", new Request("http://localhost/api/select-intent", { method: "POST", body: JSON.stringify(request) }));
    expect(http?.status).toBe(409);
    expect((await get(viewing.service, "/api/intents"))?.body).toMatchObject({ value: { space: "team-b", selected: null } });
    expect(await routePost(viewing.service, "/api/select-intent", { intent: "shared", expectedSpace: "team-b" })).toMatchObject({ status: 200, body: { value: { space: "team-b", selected: "shared" } } });
  });
  it("lists spaces without an active intent and switches using the engine", async () => {
    const { service, engine } = fixture();
    expect((await get(service, "/api/spaces"))?.body).toMatchObject({ ok: true, value: { active: "default", spaces: ["default", "empty", "team-b"] } });
    expect(await change(service, "empty")).toMatchObject({ status: 200, body: { ok: true, value: { space: "empty", all: [], selected: null } } });
    expect(engine.switch).toHaveBeenCalledWith("empty", ".cursor");
  });
  it("invalidates a same-named intent's matrix and emits a space event", async () => {
    const { service, messages } = fixture({ initialSelected: "shared" });
    service.startMatrixBackground();
    await vi.waitFor(() => expect(service.readContext.matrix()).toMatchObject({ value: { units: ["unit-default"] } }));
    expect(await change(service)).toMatchObject({ status: 200 });
    await vi.waitFor(() => expect(service.readContext.matrix()).toMatchObject({ value: { units: ["unit-team-b"] } }));
    expect(messages).toContainEqual({ type: "space-selected", space: "team-b", intent: "shared" });
  });
  it("follows external cursor changes even when the selected space is empty", async () => {
    await writeFile(path.join(root, "aidlc/active-space"), "empty");
    const { service, messages } = fixture();
    stops.push(service.startWatch());
    await get(service, "/api/intents");
    await new Promise((done) => setTimeout(done, 400));
    await writeFile(path.join(root, "aidlc/active-space"), "team-b");
    await vi.waitFor(() => expect(messages).toContainEqual({ type: "space-selected", space: "team-b", intent: "shared" }), { timeout: 4000 });
  });
  it("does not carry a pin into another space with multiple intents", async () => {
    await mkdir(path.join(root, "aidlc/spaces/team-b/intents/other"));
    const { service } = fixture({ initialSelected: "shared" });
    await get(service, "/api/intents");
    expect(await change(service)).toMatchObject({ body: { value: { selected: null } } });
    expect(await change(service, "default", "team-b")).toMatchObject({ body: { value: { selected: "shared" } } });
  });
  it("refuses an untrusted workspace before executing a command", async () => {
    const { service, engine } = fixture({ canEdit: () => false });
    expect(await change(service)).toMatchObject({ status: 403 });
    expect(engine.switch).not.toHaveBeenCalled();
  });
  it("honors the version gate before listing or switching spaces", async () => {
    const { service, engine } = fixture({
      versionGate: () => ({
        status: "project-older",
        target: "2.11.0",
        tools: [{ id: "claude", label: "Claude Code", version: "2.10.0" }],
        pin: null,
        engine: null,
        native: false,
        message: "Update required",
      }),
    });
    expect(await get(service, "/api/spaces")).toMatchObject({ status: 409, body: { reason: "version-gate" } });
    expect(await change(service)).toMatchObject({ status: 409, body: { reason: "version-gate" } });
    expect(engine.switch).not.toHaveBeenCalled();
  });
  it("rejects missing spaces, path traversal, unknown tools, and stale requests", async () => {
    const { service, engine } = fixture();
    for (const space of ["missing", "../team-b", "a/b", ""])
      expect(await change(service, space)).toMatchObject({ status: 400 });
    expect(await routePost(service, "/api/switch-space", { space: "team-b", expectedSpace: "default", harness: "../tool" })).toMatchObject({ status: 400 });
    expect(await change(service, "team-b", "old-space")).toMatchObject({ status: 409 });
    expect(engine.switch).not.toHaveBeenCalled();
  });
  it("does not report success when the engine did not move the cursor", async () => {
    const { service, engine } = fixture();
    engine.switch.mockResolvedValue(undefined);
    expect(await change(service)).toMatchObject({ status: 409 });
    expect((await get(service, "/api/intents"))?.body).toMatchObject({ value: { space: "default" } });
  });
});
