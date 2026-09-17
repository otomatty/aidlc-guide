import type { CustomizationCatalog, CustomizationItem } from "@aidlc-guide/shared-types";
import { describe, expect, it, vi } from "vitest";
import { EditorController } from "../src/components/customization/editor-controller";
import {
  ruleBody,
  setJsonField,
  setRuleBody,
  setRuleHeading,
  setSourceBody,
  setSourceField,
  sourceField,
} from "../src/components/customization/source-fields";

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
it("keeps the rule heading and body consistent while preserving the remaining bytes", () => {
  const before = "## Previous\r\n\r\nKeep `literal` text.\r\n### Subheading\r\n";
  const renamed = setRuleHeading(before, "New");
  expect(renamed).toBe("## New\r\n\r\nKeep `literal` text.\r\n### Subheading\r\n");
  expect(ruleBody(renamed)).toBe("\r\nKeep `literal` text.\r\n### Subheading\r\n");
  expect(setRuleBody(renamed, "New", "Revised\r\n")).toBe("## New\r\nRevised\r\n");
  expect(setRuleBody("", "Added", "New policy\n")).toBe("## Added\nNew policy\n");
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

it("buffers edits until the page submits them and loses unsaved input in a new editor", async () => {
  const api = { catalog: vi.fn(async () => structuredClone(catalog)), save: vi.fn() };
  const editor = new EditorController(api);
  await editor.load();
  editor.edit({ ...item, content: "local" });
  expect(api.save).not.toHaveBeenCalled();
  expect(editor.request()).toMatchObject({
    expectedConfigurationRevision: "config-1",
    changes: [{ operation: "replace", item: { content: "local" } }],
  });
  const reopened = new EditorController(api);
  await reopened.load();
  expect(reopened.getSnapshot().items[0]?.content).toBe("original");
});
it("rebases edits made during a save onto its new revision, including additions and deletions", async () => {
  let remote = catalog;
  const editor = new EditorController({ catalog: async () => remote });
  await editor.load();
  editor.edit({ ...item, content: "sent" });
  const sent = editor.getSnapshot().items;
  editor.edit({ ...item, content: "typed while saving" });
  editor.edit({ ...item, id: "new", content: "added" });
  remote = { ...catalog, configurationRevision: "config-2", items: sent };
  await editor.acceptSaved(sent, "default");
  expect(editor.request()).toMatchObject({
    expectedConfigurationRevision: "config-2",
    changes: [
      { operation: "replace", item: { id: "rule", content: "typed while saving" } },
      { operation: "create", item: { id: "new" } },
    ],
  });
  const next = editor.getSnapshot().items;
  editor.remove("new");
  remote = { ...remote, configurationRevision: "config-3", items: next };
  await editor.acceptSaved(next, "default");
  expect(editor.request().changes).toEqual([{ operation: "remove", itemId: "new" }]);
});
it("returns to a clean state when an edit is undone or an unsaved creation is removed", async () => {
  const editor = new EditorController({ catalog: async () => catalog });
  await editor.load();
  editor.edit({ ...item, content: "local" });
  editor.edit(item);
  expect(editor.getSnapshot().dirtyIds).toEqual([]);
  editor.edit({ ...item, id: "new" });
  editor.remove("new");
  expect(editor.request().changes).toEqual([]);
});
it("preserves input on a remote update and rebases only explicitly chosen edits", async () => {
  let remote = catalog;
  const editor = new EditorController({ catalog: async () => remote });
  await editor.load();
  editor.edit({ ...item, content: "local" });
  remote = {
    ...catalog,
    configurationRevision: "config-2",
    items: [
      { ...item, content: "remote" },
      { ...item, id: "other" },
    ],
  };
  await editor.refresh();
  expect(editor.getSnapshot().items[0]?.content).toBe("local");
  expect(() => editor.request()).toThrow("比較");
  editor.resolveConflict(new Set([item.id]));
  expect(editor.request()).toMatchObject({
    expectedConfigurationRevision: "config-2",
    changes: [{ operation: "replace", item: { content: "local" } }],
  });
  expect(editor.getSnapshot().items.find((value) => value.id === "other")).toBeTruthy();
});
it("ignores a stale refresh that arrives after the user starts typing", async () => {
  let resolve: (value: CustomizationCatalog) => void = () => {};
  const api = { catalog: vi.fn(async () => catalog) };
  const editor = new EditorController(api);
  await editor.load();
  api.catalog.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const refresh = editor.refresh();
  editor.edit({ ...item, content: "local" });
  resolve({ ...catalog, configurationRevision: "new" });
  await refresh;
  expect(editor.getSnapshot().items[0]?.content).toBe("local");
});
it("does not permit editing or saving a shared catalog", async () => {
  const editor = new EditorController({ catalog: async () => ({ ...catalog, hostMode: true }) });
  await editor.load();
  editor.edit({ ...item, content: "changed" });
  expect(editor.getSnapshot().items).toEqual([item]);
  expect(() => editor.request()).toThrow("共有閲覧");
});
