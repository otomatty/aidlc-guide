import type {
  CustomizationCatalog,
  CustomizationDraft,
  CustomizationItem,
  CustomizationSaveRequest,
} from "@aidlc-guide/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftController } from "../src/components/customization/draft-controller";
import {
  ruleBody,
  setJsonField,
  setRuleBody,
  setRuleHeading,
  setSourceBody,
  setSourceField,
  sourceField,
} from "../src/components/customization/source-fields";
import { type CustomizationApi, CustomizationError } from "../src/services/customization";

const item: CustomizationItem = {
  id: "rule",
  title: "Rules",
  kind: "rule-section",
  owner: "project",
  content: "original",
  target: { layer: "project", heading: "Rules" },
};
const catalog: CustomizationCatalog = {
  workspaceName: "fixture",
  spaceId: "default",
  spaces: ["default"],
  engineVersion: "2.8.2",
  configurationRevision: "config-1",
  capabilities: {
    available: true,
    engineVersion: "2.8.2",
    protocolVersion: 1,
    canApply: true,
    canExportPlugin: true,
    canRecover: true,
  },
  items: [item],
  diagnostics: [],
  hostMode: false,
};
const draft = (revision = 1, items = [item]): CustomizationDraft => ({
  schemaVersion: 1,
  id: "draft",
  revision,
  spaceId: "default",
  baseConfigurationRevision: "config-1",
  engineVersion: "2.8.2",
  capabilityProfile: "all",
  updatedAt: "2026-09-15T00:00:00Z",
  baseItems: [item],
  items,
  removedItemIds: [],
});
function setup() {
  let remote: CustomizationDraft | null = draft();
  const save = vi.fn(async (body: CustomizationSaveRequest) => {
    const values = new Map((remote?.items ?? [item]).map((value) => [value.id, value]));
    for (const change of body.changes)
      if (change.operation === "remove") values.delete(change.itemId);
      else values.set(change.item.id, change.item);
    remote = draft((remote?.revision ?? 0) + 1, [...values.values()]);
    return remote;
  });
  const api = {
    catalog: vi.fn(async () => catalog),
    draft: vi.fn(async () => remote),
    save,
    discard: vi.fn(async () => {
      remote = null;
      return null;
    }),
  } as unknown as CustomizationApi;
  return {
    controller: new DraftController(api),
    api,
    save,
    setRemote: (value: CustomizationDraft | null) => {
      remote = value;
    },
  };
}
afterEach(() => vi.useRealTimers());

it("keeps the rule heading and body consistent while preserving the remaining bytes", () => {
  const before = "## Previous\r\n\r\nKeep `literal` text.\r\n### Subheading\r\n";
  const renamed = setRuleHeading(before, "New");
  expect(renamed).toBe("## New\r\n\r\nKeep `literal` text.\r\n### Subheading\r\n");
  expect(ruleBody(renamed)).toBe("\r\nKeep `literal` text.\r\n### Subheading\r\n");
  expect(setRuleBody(renamed, "New", "Revised\r\n")).toBe("## New\r\nRevised\r\n");
  expect(setRuleBody("", "Added", "New policy\n")).toBe("## Added\nNew policy\n");
});

describe("customization draft queue", () => {
  it.each([false, true])(
    "keeps deletion after a completed create loses its receipt (already removed: %s)",
    async (alreadyRemoved) => {
      const { controller, api, save, setRemote } = setup();
      await controller.load();
      const added = { ...item, id: "added" };
      let reject!: (error: Error) => void;
      save.mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      );
      controller.edit(added);
      const saving = controller.flush();
      controller.remove(added.id);
      setRemote(draft(3, alreadyRemoved ? [item] : [item, added]));
      api.request = vi.fn(async () => null);
      reject(new CustomizationError("request-already-completed", "completed"));
      await expect(saving).rejects.toThrow();
      expect(controller.getSnapshot().dirtyIds).toContain(added.id);
      expect(controller.getSnapshot().status).toBe("conflict");
      await controller.resolveConflict(new Set([added.id]));
      expect(save).toHaveBeenCalledTimes(alreadyRemoved ? 1 : 2);
      if (!alreadyRemoved)
        expect(save.mock.calls[1]?.[0].changes).toEqual([
          { operation: "remove", itemId: added.id },
        ]);
      expect(controller.getSnapshot().items.some((entry) => entry.id === added.id)).toBe(false);
      controller.dispose();
    },
  );

  it("retries reconciliation without resending a known completed create after lookup fails", async () => {
    const { controller, api, save, setRemote } = setup();
    await controller.load();
    const added = { ...item, id: "added" };
    let reject!: (error: Error) => void;
    save.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    controller.edit(added);
    const saving = controller.flush();
    controller.remove(added.id);
    api.request = vi.fn().mockRejectedValueOnce(new Error("lookup failed")).mockResolvedValue(null);
    setRemote(draft(3, [item, added]));
    reject(new CustomizationError("request-already-completed", "completed"));
    await expect(saving).rejects.toThrow("lookup failed");
    expect(controller.getSnapshot().status).toBe("error");
    await expect(controller.flush()).rejects.toThrow("比較");
    expect(save).toHaveBeenCalledTimes(1);
    await controller.resolveConflict(new Set([added.id]));
    expect(save.mock.calls[1]?.[0].changes).toEqual([{ operation: "remove", itemId: added.id }]);
    controller.dispose();
  });
  it.each(["response-unknown", "unavailable"])(
    "retains removal until an uncertain create resolves (%s)",
    async (reason) => {
      const { controller, save } = setup();
      await controller.load();
      let rejectSave!: (error: Error) => void;
      save.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSave = reject;
          }),
      );
      const added = { ...item, id: "new-item" };
      controller.edit(added);
      const saving = controller.flush();
      controller.remove(added.id);
      rejectSave(new CustomizationError(reason, "uncertain"));
      await expect(saving).rejects.toThrow("uncertain");
      await controller.flush();
      expect(save.mock.calls[1]?.[0]).toEqual(save.mock.calls[0]?.[0]);
      expect(save.mock.calls[2]?.[0].changes).toEqual([{ operation: "remove", itemId: added.id }]);
      expect(controller.getSnapshot().items.some((entry) => entry.id === added.id)).toBe(false);
      controller.dispose();
    },
  );
  it.each(["operation-active", "local-storage-unavailable"])(
    "drops removal of a create rejected with %s while keeping other edits",
    async (reason) => {
      const { controller, save } = setup();
      await controller.load();
      let rejectSave!: (error: Error) => void;
      save.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSave = reject;
          }),
      );
      const added = { ...item, id: "new-item" };
      controller.edit(added);
      const saving = controller.flush();
      controller.remove(added.id);
      controller.edit({ ...item, content: "keep this" });
      rejectSave(new CustomizationError(reason, "rejected"));
      await expect(saving).rejects.toThrow("rejected");
      await controller.flush();
      expect(save.mock.calls[1]?.[0].changes).toEqual([
        { operation: "replace", item: { ...item, content: "keep this" } },
      ]);
      expect(controller.getSnapshot().dirtyIds).toEqual([]);
      controller.dispose();
    },
  );
  it("cancels an unsaved create locally while retaining other pending edits", async () => {
    vi.useFakeTimers();
    const { controller, save } = setup();
    await controller.load();
    const added = { ...item, id: "new-item" };
    controller.edit(added);
    controller.remove(added.id);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    expect(controller.getSnapshot().dirtyIds).toEqual([]);
    controller.edit({ ...item, content: "other edit" });
    controller.edit(added);
    controller.remove(added.id);
    await controller.flush();
    expect(save.mock.calls[0]?.[0].changes).toEqual([
      { operation: "replace", item: { ...item, content: "other edit" } },
    ]);
    controller.dispose();
  });
  it("queues removal after an in-flight create finishes", async () => {
    const { controller, save } = setup();
    await controller.load();
    let complete!: (value: CustomizationDraft) => void;
    save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const added = { ...item, id: "new-item" };
    controller.edit(added);
    const saving = controller.flush();
    controller.remove(added.id);
    complete(draft(2, [item, added]));
    await saving;
    expect(save.mock.calls[1]?.[0].changes).toEqual([{ operation: "remove", itemId: added.id }]);
    expect(controller.getSnapshot().items.some((value) => value.id === added.id)).toBe(false);
    controller.dispose();
  });
  it("replaces a catalog item when keeping edits after another window discarded the draft", async () => {
    const { controller, save, setRemote } = setup();
    await controller.load();
    controller.edit({ ...item, content: "mine" });
    setRemote(null);
    await controller.refresh();
    await controller.resolveConflict(new Set([item.id]));
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      expectedDraftRevision: 0,
      changes: [{ operation: "replace", item: { id: item.id, content: "mine" } }],
    });
    expect(controller.getSnapshot().items[0]?.content).toBe("mine");
    controller.dispose();
  });
  it("does not restore an old poll response after accepting an applied draft", async () => {
    const { controller, api } = setup();
    await controller.load();
    let resolveRead!: (value: CustomizationDraft) => void;
    vi.mocked(api.draft).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    const reading = controller.refresh();
    controller.acceptDraft(draft(3, [{ ...item, content: "applied" }]));
    resolveRead(draft(1));
    await reading;
    expect(controller.getSnapshot().draft?.revision).toBe(3);
    expect(controller.getSnapshot().items[0]?.content).toBe("applied");
    controller.dispose();
  });
  it("ignores an old load failure after a newer load succeeded", async () => {
    const { controller, api } = setup();
    let rejectRead!: (error: Error) => void;
    vi.mocked(api.catalog).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRead = reject;
        }),
    );
    const old = controller.load();
    await controller.load();
    rejectRead(new Error("old connection failure"));
    await old;
    expect(controller.getSnapshot().status).toBe("saved");
    expect(controller.getSnapshot().error).toBeNull();
    controller.dispose();
  });
  it("debounces to 800ms and saves the newest input", async () => {
    vi.useFakeTimers();
    const { controller, save } = setup();
    await controller.load();
    controller.edit({ ...item, content: "a" });
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    controller.edit({ ...item, content: "ab" });
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].changes).toEqual([
      { operation: "replace", item: { ...item, content: "ab" } },
    ]);
    expect(controller.getSnapshot().status).toBe("saved");
    controller.dispose();
  });
  it("does not replace newer typing with an earlier save response, and flush drains both", async () => {
    const { controller, save } = setup();
    await controller.load();
    let finish: (value: CustomizationDraft) => void = () => {};
    save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    controller.edit({ ...item, content: "first" });
    const saving = controller.flush();
    controller.edit({ ...item, content: "later" });
    finish(draft(2, [{ ...item, content: "first" }]));
    await saving;
    expect(save).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().items[0]?.content).toBe("later");
    expect(controller.getSnapshot().dirtyIds).toEqual([]);
    controller.dispose();
  });
  it("retries an uncertain save with the identical ID and payload", async () => {
    const { controller, save } = setup();
    await controller.load();
    save.mockRejectedValueOnce(new CustomizationError("response-unknown", "unknown"));
    controller.edit({ ...item, content: "first" });
    await expect(controller.flush()).rejects.toThrow("unknown");
    const original = save.mock.calls[0]?.[0];
    controller.edit({ ...item, content: "later" });
    await controller.flush();
    expect(save.mock.calls[1]?.[0]).toEqual(original);
    expect(save.mock.calls[2]?.[0].requestId).not.toBe(original?.requestId);
    expect(controller.getSnapshot().items[0]?.content).toBe("later");
    controller.dispose();
  });
  it("keeps local input on a remote revision change until the user chooses", async () => {
    const { controller, save, setRemote } = setup();
    await controller.load();
    controller.edit({ ...item, content: "mine" });
    setRemote(draft(3, [{ ...item, content: "theirs" }]));
    await controller.refresh();
    expect(controller.getSnapshot().status).toBe("conflict");
    expect(controller.getSnapshot().items[0]?.content).toBe("mine");
    await expect(controller.flush()).rejects.toThrow("比較");
    expect(save).not.toHaveBeenCalled();
    await controller.resolveConflict(new Set());
    expect(controller.getSnapshot().items[0]?.content).toBe("theirs");
    expect(save).not.toHaveBeenCalled();
    controller.dispose();
  });
  it("uses the remote revision only after explicit keep-local resolution", async () => {
    const { controller, save, setRemote } = setup();
    await controller.load();
    controller.edit({ ...item, content: "mine" });
    setRemote(draft(4, [{ ...item, content: "theirs" }]));
    await controller.refresh();
    await controller.resolveConflict(new Set([item.id]));
    expect(save.mock.calls[0]?.[0].expectedDraftRevision).toBe(4);
    expect(controller.getSnapshot().items[0]?.content).toBe("mine");
    controller.dispose();
  });
  it("cancels queued autosave when explicitly discarding", async () => {
    vi.useFakeTimers();
    const { controller, save } = setup();
    await controller.load();
    controller.edit({ ...item, content: "discard" });
    await controller.discard();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    expect(controller.getSnapshot().draft).toBeNull();
    expect(controller.getSnapshot().items[0]?.content).toBe("original");
    controller.dispose();
  });
  it("never reads draft data or sends edits from a shared host", async () => {
    const { controller, api, save } = setup();
    vi.mocked(api.catalog).mockResolvedValue({ ...catalog, hostMode: true });
    await controller.load();
    controller.edit({ ...item, content: "blocked" });
    await expect(controller.flush()).rejects.toThrow("共有");
    expect(api.draft).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    controller.dispose();
  });
});

describe("structured source fields", () => {
  it.each(["\n", "\r\n"])(
    "preserves separation before comments on empty YAML values (%j)",
    (newline) => {
      const source = `---${newline}key:  # keep this comment${newline}unknown: true${newline}---${newline}Body`;
      const changed = setSourceField(source, "key", "value");
      expect(changed).toBe(source.replace("key:", 'key: "value"'));
      expect(sourceField(changed, "key")).toBe("value");
    },
  );
  it("updates a JSON value without reformatting unknown properties", () => {
    const source = '{\r\n  "name" : "before",\r\n  "unknown": { "retain": [1, 2] }\r\n}\r\n';
    expect(setJsonField(source, "name", "after")).toBe(source.replace('"before"', '"after"'));
  });
  it("preserves BOM, CRLF, unknown fields and inline comments when updating one field", () => {
    const source =
      "\uFEFF---\r\nname: old # keep this\r\ncustom: {a: 1}\r\n# comment\r\n---\r\nBody\r\n";
    const changed = setSourceField(source, "name", "new");
    expect(changed).toBe(source.replace("name: old", 'name: "new"'));
    expect(sourceField(changed, "custom")).toEqual({ a: 1 });
  });
  it("replaces a block value without swallowing the following field", () => {
    const source = "---\nscopes:\n  - first\n  - second\ncustom: kept\n---\nbody";
    const changed = setSourceField(source, "scopes", ["third"]);
    expect(sourceField(changed, "scopes")).toEqual(["third"]);
    expect(sourceField(changed, "custom")).toBe("kept");
    expect(changed.endsWith("---\nbody")).toBe(true);
  });
  it("preserves metadata when editing prose and refuses malformed metadata", () => {
    expect(setSourceBody("---\ncustom: yes\n---\nold", "new")).toBe("---\ncustom: yes\n---\nnew");
    expect(() => setSourceField("---\nname: [\n---\ntext", "name", "x")).toThrow();
  });
});
