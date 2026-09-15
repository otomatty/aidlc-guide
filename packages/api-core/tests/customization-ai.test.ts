import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CustomizationAiJob, CustomizationResult } from "@aidlc-guide/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CliRunOptions } from "../src/ai-cli/process";
import { CustomizationStorage } from "../src/customization/storage";
import {
  type CustomizationAiContext,
  type CustomizationAiDependencies,
  type CustomizationAiService,
  createCustomizationAiService,
} from "../src/customization-ai";
import {
  listCustomizationMaterials,
  readCustomizationMaterials,
} from "../src/customization-ai/materials";
import {
  buildCustomizationPrompt,
  parseCustomizationProposal,
} from "../src/customization-ai/prompt";
import { acceptsCustomizationOrigin, readCustomizationBody } from "../src/handlers/local-request";

const roots: string[] = [];
const services: CustomizationAiService[] = [];
const context: CustomizationAiContext = {
  draft: {
    schemaVersion: 1,
    id: "draft-one",
    revision: 1,
    spaceId: "default",
    baseConfigurationRevision: "config-one",
    engineVersion: "2.8.2",
    capabilityProfile: "1",
    updatedAt: "2026-09-15T00:00:00Z",
    baseItems: [],
    removedItemIds: [],
    items: [
      {
        id: "rule-one",
        kind: "rule-section",
        title: "Testing",
        owner: "project",
        content: "## Testing\nKeep unknown prose.\n",
        target: { layer: "team", heading: "Testing" },
        source: { relativePath: "aidlc/spaces/default/memory/team.md", hash: "abc" },
      },
    ],
  },
  catalog: {
    workspaceName: "example",
    spaceId: "default",
    spaces: ["default"],
    engineVersion: "2.8.2",
    configurationRevision: "config-one",
    capabilities: {
      available: true,
      engineVersion: "2.8.2",
      protocolVersion: 1,
      canApply: true,
      canExportPlugin: true,
      canRecover: true,
    },
    items: [],
    diagnostics: [],
    hostMode: false,
  },
};
const proposalText = JSON.stringify({
  schemaVersion: 1,
  summary: "テスト方針を変更します。",
  changes: [
    {
      operation: "replace",
      item: {
        ...context.draft.items[0],
        source: undefined,
        content: "## Testing\nRun regression tests.\n",
      },
    },
  ],
});
const request = () => ({
  requestId: `${Date.now()}-${randomUUID()}`,
  draftId: "draft-one",
  expectedDraftRevision: 1,
  message: "テスト方針を変更してください",
  tool: "claude" as const,
});
function value<T>(result: CustomizationResult<T>): T {
  if ("error" in result) throw new Error(result.reason);
  return result.value;
}

async function setup(
  options: {
    root?: string;
    hostMode?: boolean;
    dependencies?: Partial<CustomizationAiDependencies>;
    context?: CustomizationAiContext;
  } = {},
) {
  const root = options.root ?? (await mkdtemp(path.join(tmpdir(), "aidlc-customization-ai-test-")));
  if (!options.root) roots.push(root);
  const run = vi.fn(async (_options: CliRunOptions) => proposalText);
  const propose = vi.fn(async (input, draftId, revision, contextHash) => ({
    ...input,
    id: randomUUID(),
    draftId,
    draftRevision: revision,
    configurationRevision: "config-one",
    contextHash,
    createdAt: new Date().toISOString(),
  }));
  const probe = vi.fn(async (tool) => ({
    tool,
    label: tool,
    available: true,
    command: "fake-cli",
  }));
  const service = createCustomizationAiService({
    workspaceRoot: root,
    hostMode: options.hostMode ?? false,
    context: async () => structuredClone(options.context ?? context),
    propose,
    dependencies: {
      probe,
      run,
      scratch: async () => ({ cwd: root, env: {}, cleanup: async () => {} }),
      identity: async (pid) => `test:${pid}`,
      stop: async () => true,
      timeoutMs: 5000,
      ...options.dependencies,
    },
  });
  services.push(service);
  return { service, root, run, propose, probe };
}
async function finish(service: CustomizationAiService, id: string): Promise<CustomizationAiJob> {
  await vi.waitFor(
    async () => {
      expect(["completed", "error", "cancelled", "interrupted"]).toContain(
        value(await service.get(id)).phase,
      );
    },
    { timeout: 7000 },
  );
  return value(await service.get(id));
}
afterEach(async () => {
  for (const service of services.splice(0)) service.dispose();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("customization AI proposal boundary", () => {
  it("persists a proposal and conversation without modifying the draft or current rules", async () => {
    const { service, root, propose, run } = await setup();
    const original = path.join(root, "rules.md");
    await writeFile(original, "original");
    const storage = new CustomizationStorage(root);
    await storage.writeJson("draft.json", context.draft);
    const before = await readFile(await storage.path("draft.json"));
    const body = request();
    const accepted = value(await service.start(body));
    const completed = await finish(service, accepted.id);
    expect(completed.proposal?.summary).toBe("テスト方針を変更します。");
    expect(propose).toHaveBeenCalledTimes(1);
    expect(await readFile(await storage.path("draft.json"))).toEqual(before);
    expect(await readFile(original, "utf8")).toBe("original");
    expect(value(await service.start(body)).id).toBe(accepted.id);
    expect(run).toHaveBeenCalledTimes(1);
    const reopened = await setup({ root });
    expect(value(await reopened.service.conversation("draft-one")).jobs[0]?.proposal?.id).toBe(
      completed.proposal?.id,
    );
    const restored = await reopened.service.request(body.requestId);
    if (!restored) throw new Error("missing-request");
    expect(value(restored).id).toBe(accepted.id);
  });

  it("deduplicates simultaneous requests across services and rejects changed bodies", async () => {
    const first = await setup();
    const second = await setup({ root: first.root });
    const body = request();
    const [a, b] = await Promise.all([first.service.start(body), second.service.start(body)]);
    expect(value(a).id).toBe(value(b).id);
    await finish(first.service, value(a).id);
    expect(first.run.mock.calls.length + second.run.mock.calls.length).toBe(1);
    expect(await first.service.start({ ...body, message: "different" })).toMatchObject({
      error: true,
      reason: "request-conflict",
    });
  });

  it("stops a job from another service and never publishes the cancelled result", async () => {
    let started = false;
    const first = await setup({
      dependencies: {
        run: (options) =>
          new Promise((resolve) => {
            started = true;
            options.signal.addEventListener("abort", () => resolve(proposalText), { once: true });
          }),
      },
    });
    const second = await setup({ root: first.root });
    const job = value(await first.service.start(request()));
    await vi.waitFor(() => expect(started).toBe(true));
    expect(await second.service.start(request())).toMatchObject({ error: true, reason: "ai-busy" });
    expect(value(await second.service.cancel(job.id)).phase).toBe("stopping");
    expect((await finish(first.service, job.id)).proposal).toBeUndefined();
    expect(first.propose).not.toHaveBeenCalled();
  });

  it("refuses host mode, stale revisions, expired request IDs, and invalid proposal JSON", async () => {
    const shared = await setup({ hostMode: true });
    expect(await shared.service.start(request())).toMatchObject({
      error: true,
      reason: "read-only-mode",
    });
    expect(await shared.service.tools()).toMatchObject({ error: true });
    expect(shared.probe).not.toHaveBeenCalled();
    const local = await setup({ dependencies: { run: async () => "not a proposal" } });
    expect(await local.service.start({ ...request(), expectedDraftRevision: 9 })).toMatchObject({
      error: true,
      reason: "draft-conflict",
    });
    expect(
      await local.service.start({ ...request(), requestId: `1000000000000-${randomUUID()}` }),
    ).toMatchObject({ error: true, reason: "request-expired" });
    const job = value(await local.service.start(request()));
    expect((await finish(local.service, job.id)).phase).toBe("error");
    expect(local.propose).not.toHaveBeenCalled();
  });

  it("can answer a question without generating a mutation", async () => {
    const { service, propose } = await setup({
      dependencies: {
        run: async () =>
          JSON.stringify({ schemaVersion: 1, summary: "設定の説明です。", changes: [] }),
      },
    });
    const completed = await finish(service, value(await service.start(request())).id);
    expect(completed.answer).toBe("設定の説明です。");
    expect(completed.proposal).toBeUndefined();
    expect(propose).not.toHaveBeenCalled();
  });

  it("keeps server provenance and rejects paths, unknown targets, and ownership forgery", () => {
    const parsed = parseCustomizationProposal(proposalText, context);
    expect(parsed.changes[0]).toMatchObject({ item: { source: context.draft.items[0]?.source } });
    for (const item of [
      { ...context.draft.items[0], source: { relativePath: "../../secret", hash: "x" } },
      { ...context.draft.items[0], source: undefined, owner: "core" },
      { ...context.draft.items[0], source: undefined, target: { command: "rm" } },
    ])
      expect(() =>
        parseCustomizationProposal(
          JSON.stringify({
            schemaVersion: 1,
            summary: "x",
            changes: [{ operation: "replace", item }],
          }),
          context,
        ),
      ).toThrow("invalid-proposal");
    expect(() =>
      parseCustomizationProposal(
        '{"schemaVersion":1,"summary":"x","changes":[{"operation":"remove","itemId":"unknown"}]}',
        context,
      ),
    ).toThrow("invalid-proposal");
  });

  it("bounds context and excludes paths, binary data, and unselected reference materials", () => {
    const expanded = structuredClone(context);
    const first = expanded.draft.items[0];
    if (!first) throw new Error("missing-fixture");
    expanded.draft.items.push({
      ...first,
      id: "large",
      content: "x".repeat(100_000),
    });
    expanded.materials = [
      { id: "secret", title: "do not include", hash: "x", content: "UNSELECTED_SECRET" },
    ];
    const prompt = buildCustomizationPrompt(request(), expanded, []);
    expect(prompt.truncated).toBe(true);
    expect(prompt.text).not.toContain("aidlc/spaces/");
    expect(prompt.text).not.toContain("UNSELECTED_SECRET");
    expect(prompt.text).toContain("untrusted");
  });
});

describe("customization local HTTP boundary", () => {
  it("accepts same-origin only unless the exact local development origin was configured", () => {
    const url = "http://localhost:3000/api/customization/apply";
    expect(
      acceptsCustomizationOrigin(
        new Request(url, { headers: { origin: "http://localhost:3000" } }),
      ),
    ).toBe(true);
    expect(
      acceptsCustomizationOrigin(
        new Request(url, { headers: { origin: "http://localhost:5173" } }),
      ),
    ).toBe(false);
    expect(
      acceptsCustomizationOrigin(
        new Request(url, { headers: { origin: "http://localhost:5173" } }),
        "http://localhost:5173",
      ),
    ).toBe(true);
    expect(
      acceptsCustomizationOrigin(new Request("http://attacker.example/api/customization/apply")),
    ).toBe(false);
    expect(acceptsCustomizationOrigin(new Request(url, { headers: { origin: "null" } }))).toBe(
      false,
    );
    expect(
      acceptsCustomizationOrigin(new Request(url, { headers: { "sec-fetch-site": "cross-site" } })),
    ).toBe(false);
  });
  it("bounds streamed bytes, checks content type and rejects malformed JSON", async () => {
    const request = (body: string, type = "application/json") =>
      new Request("http://localhost:3000", {
        method: "POST",
        body,
        headers: { "content-type": type },
      });
    expect(await readCustomizationBody(request('{"x":1}'))).toEqual({ x: 1 });
    await expect(readCustomizationBody(request("{}", "text/plain"))).rejects.toThrow(
      "json-required",
    );
    await expect(readCustomizationBody(request("{}"), 1)).rejects.toThrow("body-too-large");
    await expect(readCustomizationBody(request("invalid"))).rejects.toThrow();
  });
});

describe("selected workflow materials", () => {
  it("lists deliverables and reads only selected IDs without including state or audit", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "aidlc-customization-material-test-"));
    roots.push(root);
    const record = path.join(root, "aidlc/spaces/default/intents/feature-12345678");
    await mkdir(path.join(record, "inception/requirements-analysis"), { recursive: true });
    await mkdir(path.join(record, "audit"));
    await writeFile(path.join(record, "aidlc-state.md"), "private workflow state");
    await writeFile(path.join(record, "audit/events.md"), "private audit");
    await writeFile(path.join(record, "inception/requirements-analysis/memory.md"), "stage diary");
    await writeFile(
      path.join(record, "inception/requirements-analysis/requirements.md"),
      "# Actual requirements\n",
    );
    const available = await listCustomizationMaterials(root, "default");
    expect(available).toHaveLength(1);
    const item = available[0];
    if (!item) throw new Error("missing-material");
    expect(item.title).toBe("requirements.md");
    expect(await readCustomizationMaterials(root, "default", [])).toEqual([]);
    expect(await readCustomizationMaterials(root, "default", [item.id])).toMatchObject([
      { id: item.id, content: "# Actual requirements\n" },
    ]);
    await expect(readCustomizationMaterials(root, "default", ["material-unknown"])).rejects.toThrow(
      "material-not-found",
    );
    await expect(listCustomizationMaterials(root, "../escape")).rejects.toThrow("bad-request");
  });
});
