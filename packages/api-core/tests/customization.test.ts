import { spawn } from "node:child_process";
import type { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  CustomizationCatalog,
  CustomizationDraft,
  CustomizationItem,
  CustomizationPlan,
} from "@aidlc-guide/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readCompatibilityCatalog } from "../src/customization/catalog.ts";
import { MAX_DRAFT_RECEIPTS } from "../src/customization/draft-store.ts";
import type {
  CustomizationEngine,
  EngineAction,
  EngineRequest,
} from "../src/customization/engine-adapter.ts";
import { CustomizationService } from "../src/customization/index.ts";
import {
  CustomizationError,
  digest,
  localDiagnostics,
  parseItem,
} from "../src/customization/model.ts";
import { CustomizationStorage } from "../src/customization/storage.ts";
import { handleCustomizationPost, routeCustomizationRead } from "../src/handlers/customization.ts";

const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});
const item: CustomizationItem = {
  id: "rule-1",
  kind: "rule-section",
  title: "Code Style",
  owner: "project",
  spaceId: "default",
  content: "## Code Style\r\nKeep tabs.\r\n",
  target: { layer: "team", heading: "Code Style" },
  source: { relativePath: "aidlc/spaces/default/memory/team.md", hash: "basehash" },
};
const second: CustomizationItem = {
  ...item,
  id: "rule-2",
  title: "Testing",
  content: "## Testing\r\nRun focused tests.\r\n",
  target: { layer: "team", heading: "Testing" },
};
function makeCatalog(): CustomizationCatalog {
  return {
    workspaceName: "fixture",
    spaceId: "default",
    spaces: ["default"],
    engineVersion: "2.8.2",
    configurationRevision: "base",
    capabilities: {
      available: true,
      engineVersion: "2.8.2",
      protocolVersion: 1,
      canApply: true,
      canExportPlugin: true,
      canRecover: true,
    },
    diagnostics: [],
    items: [structuredClone(item), structuredClone(second)],
    hostMode: false,
  };
}
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "guide-customization-test-"));
  directories.push(root);
  const catalog = makeCatalog();
  const calls: { action: string; request: EngineRequest }[] = [];
  let applyCount = 0;
  const engine: CustomizationEngine = {
    async call<T>(action: EngineAction, request: EngineRequest): Promise<T> {
      calls.push({ action, request });
      if (action === "catalog") return structuredClone(catalog) as T;
      if (action === "validate") return { valid: true, diagnostics: [] } as T;
      if (action === "plan")
        return {
          id: "plan-1",
          configurationRevision: catalog.configurationRevision,
          files: [
            {
              relativePath: "aidlc/spaces/default/memory/team.md",
              beforeHash: "before",
              afterHash: "after",
              content: request.items?.[0]?.content,
              itemIds: [item.id],
            },
          ],
          diagnostics: [],
          canApply: true,
        } as T;
      if (action === "apply") {
        applyCount++;
        catalog.configurationRevision = "applied";
        return {
          transactionId: "transaction-1",
          status: "committed",
          configurationRevision: "applied",
        } as T;
      }
      if (action === "export")
        return {
          filename: "plugin.zip",
          mimeType: "application/zip",
          base64: "UEs=",
          diagnostics: [],
          omittedItemIds: request.selectedItemIds?.includes(item.id) ? [item.id] : [],
        } as T;
      throw new Error("unexpected engine action");
    },
  };
  const service = new CustomizationService({ workspaceRoot: root, engine });
  const draft = (await service.post("draft/save", {
    requestId: "create-1",
    expectedDraftRevision: 0,
    changes: [],
  })) as CustomizationDraft;
  return { root, service, engine, catalog, draft, calls, getApplyCount: () => applyCount };
}
const header = (draft: CustomizationDraft, requestId = "save-2") => ({
  requestId,
  draftId: draft.id,
  expectedDraftRevision: draft.revision,
});

describe("persistent customization draft", () => {
  it("bounds receipts while retaining recent retries and rejecting stale revisions", async () => {
    const { service, draft } = await fixture();
    const receipts = Object.fromEntries(
      Array.from({ length: MAX_DRAFT_RECEIPTS + 5 }, (_, index) => [
        String(index),
        { hash: "old", kind: "save", draftId: draft.id, revision: 1 },
      ]),
    );
    await service.storage.writeJson("draft.json", { schemaVersion: 1, draft, receipts });
    const mutation = header(draft, "latest");
    const saved = await service.drafts.save(mutation, []);
    const state = await service.storage.readJson<{
      receipts: Record<string, unknown>;
      receiptOrder: string[];
    }>("draft.json");
    expect(Object.keys(state?.receipts ?? {})).toHaveLength(MAX_DRAFT_RECEIPTS);
    expect(state?.receiptOrder.at(-1)).toBe("latest");
    expect(await service.drafts.request("0")).toBeNull();
    expect(await service.drafts.save(mutation, [])).toEqual(saved);
    await expect(service.drafts.save(header(draft, "0"), [])).rejects.toMatchObject({
      code: "draft-conflict",
    });
    await service.drafts.markApplied(saved.id, saved.revision, "applied");
    expect(
      Object.keys(
        (await service.storage.readJson<{ receipts: object }>("draft.json"))?.receipts ?? {},
      ),
    ).toHaveLength(MAX_DRAFT_RECEIPTS);
    expect(await service.drafts.request("latest")).toMatchObject({ status: "completed" });
  });
  it("allows catalog sections and scoped knowledge to share a runtime filename", () => {
    const sections = [item, second].map((entry) => ({ ...entry, runtimeId: "team" }));
    const knowledge: CustomizationItem[] = ["developer", "quality"].map((agent) => ({
      id: `knowledge-${agent}`,
      kind: "knowledge",
      title: "Reference",
      owner: "project",
      runtimeId: "reference",
      content: "Reference text",
      target: { knowledgeType: "team-markdown", audience: [agent] },
    }));
    expect(localDiagnostics([...sections, ...knowledge])).toEqual([]);
    const stages: CustomizationItem[] = ["one", "two"].map((id) => ({
      id,
      kind: "stage",
      title: id,
      owner: "project",
      runtimeId: "same-stage",
      content: "stage definition",
    }));
    expect(localDiagnostics(stages)).toContainEqual(
      expect.objectContaining({ code: "duplicate-id", itemId: "two" }),
    );
  });
  it("shares saved drafts across independent services and preserves untouched raw text", async () => {
    const { root, service, engine, draft } = await fixture();
    const changed = { ...item, content: "## Code Style\r\nUse spaces.\r\n" };
    await service.post("draft/save", {
      ...header(draft),
      changes: [{ operation: "replace", item: changed }],
    });
    const other = new CustomizationService({ workspaceRoot: root, engine });
    const restored = await other.draft();
    expect(restored?.items[0]?.content).toBe(changed.content);
    expect(restored?.items[1]).toEqual(second);
    expect(restored?.baseItems[0]?.content).toBe(item.content);
  });
  it("accepts incomplete text in autosave and diagnoses it separately", async () => {
    const { service, draft } = await fixture();
    await service.post("draft/save", {
      ...header(draft),
      changes: [{ operation: "replace", item: { ...item, content: "" } }],
    });
    expect((await service.validate({})).diagnostics).toContainEqual(
      expect.objectContaining({ code: "incomplete-item", itemId: item.id }),
    );
  });
  it("allows empty metadata for memory files without frontmatter", async () => {
    const { service, draft } = await fixture();
    await service.post("draft/save", {
      ...header(draft),
      changes: [
        {
          operation: "create",
          item: {
            id: "empty-metadata",
            kind: "rule-file-metadata",
            title: "team metadata",
            owner: "project",
            spaceId: "default",
            content: "",
            target: { layer: "team" },
          },
        },
      ],
    });
    expect(await service.validate({})).toEqual({ valid: true, diagnostics: [] });
    expect((await service.plan({})).canApply).toBe(true);
  });
  it("CAS permits exactly one writer from two service instances", async () => {
    const { service, engine, root, draft } = await fixture();
    const other = new CustomizationService({ workspaceRoot: root, engine });
    const results = await Promise.allSettled([
      service.post("draft/save", {
        ...header(draft, "one"),
        changes: [{ operation: "replace", item: { ...item, content: "one" } }],
      }),
      other.post("draft/save", {
        ...header(draft, "two"),
        changes: [{ operation: "replace", item: { ...item, content: "two" } }],
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await service.draft())?.revision).toBe(2);
  });
  it("replays the initial creation and a mutation without applying twice", async () => {
    const { service, draft } = await fixture();
    expect(
      await service.post("draft/save", {
        requestId: "create-1",
        expectedDraftRevision: 0,
        changes: [],
      }),
    ).toEqual(draft);
    const request = {
      ...header(draft),
      changes: [{ operation: "replace", item: { ...item, content: "changed" } }],
    };
    const next = await service.post("draft/save", request);
    expect(await service.post("draft/save", request)).toEqual(next);
    await expect(service.post("draft/save", { ...request, changes: [] })).rejects.toMatchObject({
      code: "request-id-conflict",
    });
  });
  it("keeps original request outcomes after later edits and draft disposal", async () => {
    const { service, draft } = await fixture();
    const saved = (await service.post("draft/save", {
      ...header(draft),
      changes: [],
    })) as CustomizationDraft;
    await expect(
      service.post("draft/save", { requestId: "create-1", expectedDraftRevision: 0, changes: [] }),
    ).rejects.toMatchObject({ code: "request-already-completed" });
    expect(await service.request("create-1")).toMatchObject({
      status: "completed",
      draftId: draft.id,
      draftRevision: 1,
      currentDraft: { revision: saved.revision },
    });
    await service.post("draft/discard", header(saved, "discard"));
    expect(await service.request("save-2")).toMatchObject({
      status: "completed",
      draftId: draft.id,
      draftRevision: saved.revision,
      currentDraft: null,
    });
    expect(await service.request("missing")).toBeNull();
  });
  it("rejects injected provenance and unknown input fields", async () => {
    const { service, draft } = await fixture();
    await service.post("draft/save", {
      ...header(draft),
      changes: [
        {
          operation: "replace",
          item: { ...item, source: { relativePath: "../../outside", hash: "fake" } },
        },
      ],
    });
    expect((await service.draft())?.items[0]?.source).toEqual(item.source);
    expect(() => parseItem({ ...item, unexpected: "write" })).toThrow();
    expect(() => parseItem({ ...item, target: { filename: "../../escape" } })).toThrow();
  });
  it("retains a conflicting edit until the explicit reconcile choice", async () => {
    const { service, catalog, draft } = await fixture();
    const edited = (await service.post("draft/save", {
      ...header(draft),
      changes: [{ operation: "replace", item: { ...item, content: "local" } }],
    })) as CustomizationDraft;
    catalog.configurationRevision = "external";
    catalog.items[0] = { ...item, content: "external" };
    await expect(service.plan({})).rejects.toMatchObject({ code: "configuration-changed" });
    await expect(
      service.post("draft/reconcile", { ...header(edited, "reconcile"), choices: [] }),
    ).rejects.toMatchObject({ code: "configuration-changed" });
    const resolved = (await service.post("draft/reconcile", {
      ...header(edited, "reconcile-choice"),
      choices: [{ itemId: item.id, choice: "draft" }],
    })) as CustomizationDraft;
    expect(resolved.items[0]?.content).toBe("local");
    expect(resolved.baseConfigurationRevision).toBe("external");
  });
});

describe("selected distribution", () => {
  it("exports Guide JSON on a legacy engine but still rejects invalid content and plugin generation", async () => {
    const { service, engine, draft } = await fixture();
    vi.spyOn(engine, "call").mockRejectedValue(
      new CustomizationError("engine-capability-missing", "legacy", 409),
    );
    const output = await service.export({ format: "guide", selectedItemIds: [item.id] });
    expect(JSON.parse(output.content).items).toHaveLength(1);
    expect(output.diagnostics).toContainEqual(
      expect.objectContaining({ code: "engine-capability-missing", severity: "warning" }),
    );
    await expect(
      service.export({ format: "plugin", selectedItemIds: [item.id] }),
    ).rejects.toMatchObject({ code: "engine-capability-missing" });
    await service.drafts.save(header(draft), [
      { operation: "replace", item: { ...item, content: "" } },
    ]);
    await expect(
      service.export({ format: "guide", selectedItemIds: [item.id] }),
    ).rejects.toMatchObject({ code: "validation-failed" });
  });
  it("does not hide engine validation failures behind the legacy export fallback", async () => {
    const { service, engine } = await fixture();
    vi.spyOn(engine, "call").mockRejectedValue(
      new CustomizationError("engine-unavailable", "unavailable", 503),
    );
    await expect(
      service.export({ format: "guide", selectedItemIds: [item.id] }),
    ).rejects.toMatchObject({ code: "engine-unavailable" });
  });
  it("maps an imported document reference to the explicitly imported source item", async () => {
    const { service, draft } = await fixture();
    const source: CustomizationItem = {
      id: "doc-source",
      kind: "knowledge",
      owner: "project",
      title: "Document",
      content: "",
      target: { knowledgeType: "document-source", filename: "example.txt" },
      binary: { base64: "YQ==", bytes: 1, sha256: digest("a"), mimeType: "text/plain" },
    };
    const ref: CustomizationItem = {
      id: "doc-ref",
      kind: "knowledge",
      owner: "project",
      title: "Document reference",
      content: JSON.stringify({ documentId: "source-local-id", sourceItemId: source.id }),
      target: { knowledgeType: "document-reference", audience: "all" },
    };
    const current = (await service.post("draft/save", {
      ...header(draft),
      changes: [source, ref].map((item) => ({ operation: "create", item })),
    })) as CustomizationDraft;
    const pack = await service.export({ format: "guide", selectedItemIds: [source.id, ref.id] });
    const plan = await service.packages.analyze(pack.content);
    const imported = await service.packages.adopt(header(current, "document-import"), plan.id, [
      { sourceId: source.id, targetId: null },
      { sourceId: ref.id, targetId: null },
    ]);
    const newSource = imported.items.find(
      (item) => item.target?.knowledgeType === "document-source" && item.id !== source.id,
    );
    const newRef = imported.items.find(
      (item) => item.target?.knowledgeType === "document-reference" && item.id !== ref.id,
    );
    expect(JSON.parse(newRef?.content ?? "{}").sourceItemId).toBe(newSource?.id);
    expect(newSource?.id).not.toBe(source.id);
  });
  it("keeps a chosen local document reference and refuses silent reuse of foreign identity", async () => {
    const { service, draft } = await fixture();
    const ref: CustomizationItem = {
      id: "doc-ref",
      kind: "knowledge",
      owner: "project",
      title: "Document reference",
      content: JSON.stringify({ documentId: "local-document-id", sourceItemId: "local-source" }),
      target: { knowledgeType: "document-reference", audience: "all" },
    };
    const current = (await service.post("draft/save", {
      ...header(draft),
      changes: [{ operation: "create", item: ref }],
    })) as CustomizationDraft;
    const pack = JSON.parse(
      (await service.export({ format: "guide", selectedItemIds: [ref.id] })).content,
    );
    pack.items[0].content = JSON.stringify({
      documentId: "foreign-id",
      sourceItemId: "foreign-source",
    });
    pack.contentHash = digest(JSON.stringify(pack.items));
    const plan = await service.packages.analyze(pack);
    const kept = await service.packages.adopt(header(current, "reference-local"), plan.id, [
      { sourceId: ref.id, targetId: ref.id },
    ]);
    expect(
      JSON.parse(kept.items.find((item) => item.id === ref.id)?.content ?? "{}").documentId,
    ).toBe("local-document-id");
    const freshPlan = await service.packages.analyze(pack);
    const added = await service.packages.adopt(header(kept, "reference-unresolved"), freshPlan.id, [
      { sourceId: ref.id, targetId: null },
    ]);
    expect(
      JSON.parse(
        added.items.find(
          (item) => item.target?.knowledgeType === "document-reference" && item.id !== ref.id,
        )?.content ?? "{}",
      ).documentId,
    ).toBe("unresolved-import");
  });
  it("Guide export/import changes only explicitly selected sections", async () => {
    const { service, draft } = await fixture();
    const output = await service.export({ format: "guide", selectedItemIds: [item.id] });
    const data = JSON.parse(output.content);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].source).toBeUndefined();
    data.items[0].content = "## Code Style\nImported\n";
    data.contentHash = digest(JSON.stringify(data.items));
    const plan = await service.packages.analyze(data);
    const result = await service.packages.adopt(header(draft, "import"), plan.id, [
      { sourceId: item.id, targetId: item.id },
    ]);
    expect(result.items[0]?.content).toContain("Imported");
    expect(result.items[1]).toEqual(second);
    expect(
      await service.packages.adopt(header(draft, "import"), plan.id, [
        { sourceId: item.id, targetId: item.id },
      ]),
    ).toEqual(result);
    await expect(
      service.packages.adopt(header(draft, "import"), plan.id, [
        { sourceId: item.id, targetId: null },
      ]),
    ).rejects.toMatchObject({ code: "request-id-conflict" });
  });
  it("validates binary size/hash and rejects a corrupted package", async () => {
    const { service } = await fixture();
    expect(() =>
      parseItem({
        ...item,
        binary: { base64: "YQ==", bytes: 1, sha256: "wrong", mimeType: "application/pdf" },
      }),
    ).toThrow();
    const output = await service.export({ format: "guide", selectedItemIds: [item.id] });
    const data = JSON.parse(output.content);
    data.items[0].content = "tampered";
    await expect(service.packages.analyze(data)).rejects.toMatchObject({ code: "package-corrupt" });
  });
  it("standard export delegates to engine and requires omitted-item acknowledgement", async () => {
    const { service } = await fixture();
    await expect(
      service.export({ format: "plugin", selectedItemIds: [item.id] }),
    ).rejects.toMatchObject({ code: "export-omissions" });
    const output = await service.export({
      format: "plugin",
      selectedItemIds: [item.id],
      confirmedOmissions: true,
    });
    expect(output.encoding).toBe("base64");
    expect(output.filename).toBe("plugin.zip");
  });
});

describe("formal apply and transport boundaries", () => {
  it("finalizes an immediate engine rollback and releases the draft without another recovery call", async () => {
    const { service, engine, draft } = await fixture();
    const plan = await service.plan({});
    vi.spyOn(engine, "call").mockResolvedValue({
      status: "rolled-back",
      configurationRevision: "base",
    });
    const input = {
      ...header(draft, "rollback-apply"),
      planId: plan.id,
      expectedConfigurationRevision: plan.configurationRevision,
    };
    const result = await service.apply(input);
    expect(result).toMatchObject({
      status: "failed",
      recoveryRequired: false,
      error: { code: "apply-rolled-back" },
    });
    expect(await service.activeOperation()).toBeNull();
    expect(await service.drafts.read()).toEqual(draft);
    expect(await service.apply(input)).toEqual(result);
    expect(engine.call).toHaveBeenCalledTimes(1);
    await expect(service.drafts.save(header(draft, "after-rollback"), [])).resolves.toMatchObject({
      revision: draft.revision + 1,
    });
  });
  it("sends only changed items to engine; applies a reviewed plan once", async () => {
    const { service, draft, calls, getApplyCount } = await fixture();
    const edited = (await service.post("draft/save", {
      ...header(draft),
      changes: [{ operation: "replace", item: { ...item, content: "new rule" } }],
    })) as CustomizationDraft;
    const plan = (await service.plan({})) as CustomizationPlan;
    expect(calls.find((entry) => entry.action === "plan")?.request.items).toHaveLength(1);
    expect(plan.files[0]?.after).toBe("new rule");
    const request = {
      ...header(edited, "apply-one"),
      planId: plan.id,
      expectedConfigurationRevision: plan.configurationRevision,
    };
    const result = await service.apply(request);
    expect(result.status).toBe("completed");
    expect(await service.apply(request)).toEqual(result);
    expect(getApplyCount()).toBe(1);
    expect((await service.draft())?.removedItemIds).toEqual([]);
  });
  it("refuses a plan after draft changes without invoking apply", async () => {
    const { service, draft, getApplyCount } = await fixture();
    const plan = await service.plan({});
    await service.post("draft/save", {
      ...header(draft),
      changes: [{ operation: "replace", item: { ...item, content: "later" } }],
    });
    await expect(
      service.apply({
        ...header(draft, "apply-old"),
        planId: plan.id,
        expectedConfigurationRevision: plan.configurationRevision,
      }),
    ).rejects.toMatchObject({ code: "draft-conflict" });
    expect(getApplyCount()).toBe(0);
  });
  it("recovers a committed engine response lost before Guide receives it", async () => {
    const { root, service, draft, engine, getApplyCount } = await fixture();
    const plan = await service.plan({});
    const recoverCalls: string[] = [];
    const disconnecting: CustomizationEngine = {
      async call<T>(action: EngineAction, request: EngineRequest): Promise<T> {
        if (action === "recover") {
          recoverCalls.push(String(request.requestId));
          return {
            status: "committed",
            transactionId: "transaction-1",
            configurationRevision: "applied",
          } as T;
        }
        const result = await engine.call<T>(action, request);
        if (action === "apply")
          throw new CustomizationError("engine-unavailable", "connection lost", 503);
        return result;
      },
    };
    const beforeRestart = new CustomizationService({ workspaceRoot: root, engine: disconnecting });
    const operation = await beforeRestart.apply({
      ...header(draft, "lost-apply"),
      planId: plan.id,
      expectedConfigurationRevision: plan.configurationRevision,
    });
    expect(operation).toMatchObject({ status: "running", recoveryRequired: true });
    await expect(
      service.post("draft/save", { ...header(draft, "frozen-save"), changes: [] }),
    ).rejects.toMatchObject({ code: "operation-active" });
    const restarted = new CustomizationService({ workspaceRoot: root, engine: disconnecting });
    expect((await restarted.operation(operation.id)).recoveryRequired).toBe(true);
    expect(recoverCalls).toEqual([]);
    expect(await restarted.recover({ operationId: operation.id })).toMatchObject({
      status: "completed",
      recoveryRequired: false,
    });
    expect(recoverCalls).toEqual(["lost-apply"]);
    expect(getApplyCount()).toBe(1);
    expect((await restarted.draft())?.id).not.toBe(draft.id);
    const current = await restarted.draft();
    await expect(
      restarted.post("draft/save", {
        ...header(current as CustomizationDraft, "after-recovery"),
        changes: [],
      }),
    ).resolves.toMatchObject({ revision: (current?.revision ?? 0) + 1 });
    expect((await restarted.request("lost-apply"))?.operation?.status).toBe("completed");
  });
  it.each(["rolled-back", "nothing-to-recover"])(
    "unfreezes a %s transaction while preserving the draft",
    async (status) => {
      const { root, service, draft, engine } = await fixture();
      const plan = await service.plan({});
      const stopped: CustomizationEngine = {
        async call<T>(action: EngineAction, request: EngineRequest): Promise<T> {
          if (action === "apply")
            throw new CustomizationError("engine-unavailable", "stopped", 503);
          if (action === "recover") return { status, configurationRevision: "base" } as T;
          return await engine.call<T>(action, request);
        },
      };
      const interrupted = new CustomizationService({ workspaceRoot: root, engine: stopped });
      const operation = await interrupted.apply({
        ...header(draft, "stopped-apply"),
        planId: plan.id,
        expectedConfigurationRevision: "base",
      });
      const restarted = new CustomizationService({ workspaceRoot: root, engine: stopped });
      expect(await restarted.recover({ operationId: operation.id })).toMatchObject({
        status: "failed",
        recoveryRequired: false,
      });
      expect(await restarted.draft()).toEqual(draft);
      await expect(
        restarted.post("draft/save", { ...header(draft, "after-rollback"), changes: [] }),
      ).resolves.toMatchObject({ revision: draft.revision + 1 });
    },
  );
  it("finishes unfreezing after a crash following persisted completion", async () => {
    const { service, draft } = await fixture();
    const plan = await service.plan({});
    const request = {
      ...header(draft, "cleanup-apply"),
      planId: plan.id,
      expectedConfigurationRevision: "base",
    };
    const result = await service.apply(request);
    await service.storage.writeJson("apply-running.json", {
      active: true,
      requestId: "cleanup-apply",
    });
    expect(await service.recover({ operationId: result.id })).toEqual(result);
    expect(await service.storage.readJson("apply-running.json")).toMatchObject({ active: false });
  });
  it("host mode refuses every private route and never calls the engine", async () => {
    const { root } = await fixture();
    const call = vi.fn();
    const service = new CustomizationService({
      workspaceRoot: root,
      hostMode: true,
      engine: { call },
    });
    for (const action of [
      "draft/save",
      "draft/discard",
      "import/analyze",
      "export",
      "apply",
      "plan",
      "validate",
    ])
      await expect(service.post(action, {})).rejects.toMatchObject({ code: "read-only-mode" });
    expect(
      (await routeCustomizationRead(service, new URL("http://localhost/api/customization/draft")))
        ?.status,
    ).toBe(403);
    await service.catalog();
    expect(call).not.toHaveBeenCalled();
  });
  it("rejects an untrusted workspace and cross-origin HTTP requests", async () => {
    const { root, engine } = await fixture();
    const service = new CustomizationService({ workspaceRoot: root, engine, canEdit: () => false });
    await expect(service.draft()).rejects.toMatchObject({ code: "workspace-untrusted" });
    const response = await handleCustomizationPost(
      service,
      "draft/save",
      new Request("http://127.0.0.1:4700/api/customization/draft/save", {
        method: "POST",
        headers: { origin: "https://example.com", "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
  });
  it("has no workspace writes when a local draft is saved", async () => {
    const { root, service, draft } = await fixture();
    const original = path.join(root, "unchanged.txt");
    await writeFile(original, "original");
    await service.post("draft/save", {
      ...header(draft),
      changes: [{ operation: "replace", item: { ...item, content: "new" } }],
    });
    expect(await readFile(original, "utf8")).toBe("original");
  });
  it("old owner directories cannot poison the OS-backed lock", async () => {
    const { root } = await fixture();
    const storage = new CustomizationStorage(root);
    const lock = await storage.path("test.lock", true);
    await mkdir(lock);
    await writeFile(path.join(lock, "owner.json"), JSON.stringify({ pid: 2147483647 }));
    await storage.withLock("test", () => storage.writeJson("recovered.json", { recovered: true }));
    expect(await storage.readJson("recovered.json")).toEqual({ recovered: true });
  });
  it("serializes independent processes and releases the lock after their owner is killed", async () => {
    const { root, service } = await fixture();
    const worker = path.join(root, "lock-worker.ts");
    const module = pathToFileURL(
      fileURLToPath(new URL("../src/customization/storage.ts", import.meta.url)),
    ).href;
    await writeFile(
      worker,
      `import { CustomizationStorage } from ${JSON.stringify(module)};
const storage = new CustomizationStorage(process.argv[2]);
await storage.withLock("multiprocess", async () => {
  if (process.argv[3] === "hold") { process.stdout.write("locked\\n"); await new Promise(() => setInterval(() => {}, 1000)); }
  const current = await storage.readJson("counter.json");
  await Bun.sleep(100);
  await storage.writeJson("counter.json", { value: (current?.value ?? 0) + 1 });
});`,
    );
    const start = (mode: string) => {
      const child = spawn("bun", [worker, root, mode], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return Object.assign(child, { events: child as unknown as EventEmitter });
    };
    const successful = (child: ReturnType<typeof start>) =>
      new Promise<void>((resolve, reject) => {
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.events.once("error", reject);
        child.events.once("exit", (code: number | null) =>
          code === 0 ? resolve() : reject(new Error(stderr || `worker exited: ${code}`)),
        );
      });
    await Promise.all([
      successful(start("increment")),
      successful(start("increment")),
      successful(start("increment")),
    ]);
    expect(await service.storage.readJson("counter.json")).toEqual({ value: 3 });
    const owner = start("hold");
    try {
      await new Promise<void>((resolve, reject) => {
        owner.events.once("error", reject);
        owner.stdout.once("data", () => resolve());
      });
      const exited = new Promise<void>((resolve) => owner.events.once("exit", () => resolve()));
      owner.kill("SIGKILL");
      await exited;
      await successful(start("increment"));
      expect(await service.storage.readJson("counter.json")).toEqual({ value: 4 });
    } finally {
      owner.kill("SIGKILL");
    }
  }, 20_000);
  it("reads per-space rule sections without requiring an active intent", async () => {
    const { root } = await fixture();
    const memory = path.join(root, "aidlc/spaces/default/memory");
    await mkdir(memory, { recursive: true });
    const raw = "\uFEFF---\r\nstatus: active\r\n---\r\nPreamble\r\n## One\r\nA\r\n## Two\r\nB\r\n";
    await writeFile(path.join(memory, "team.md"), raw);
    const catalog = await readCompatibilityCatalog(root);
    expect(
      catalog.items.filter((entry) => entry.kind === "rule-section").map((entry) => entry.content),
    ).toEqual(["## One\r\nA\r\n", "## Two\r\nB\r\n"]);
    expect(await readFile(path.join(memory, "team.md"), "utf8")).toBe(raw);
  });
});
