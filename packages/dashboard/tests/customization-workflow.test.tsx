import { readdirSync, readFileSync } from "node:fs";
import type { CustomizationItem } from "@aidlc-guide/shared-types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import graph from "../../../.claude/tools/data/stage-graph.json";
import { CustomizationExplorer } from "../src/components/customization/CustomizationExplorer";
import { ItemEditor } from "../src/components/customization/ItemEditor";
import { japaneseScopeDescription } from "../src/components/customization/scope-description";
import {
  createItem,
  listField,
  setSourceField,
} from "../src/components/customization/source-fields";
import { japaneseStageSection } from "../src/components/customization/stage-description";
import {
  contributionScopes,
  createOwnedPlugin,
  duplicateScope,
  removeScope,
  runsStage,
  setMembership,
  stageDiagnostics,
  stageItems,
} from "../src/components/customization/workflow-model";

const stage = (slug: string, phase: string, scopes = ["bugfix"]): CustomizationItem => ({
  id: slug,
  kind: "stage",
  runtimeId: slug,
  title: slug,
  owner: "core",
  content: `---\nslug: ${slug}\nphase: ${phase}\nscopes: ${JSON.stringify(scopes)}\nrequires_stage: []\nlead_agent: developer\n---\nOriginal work\n`,
});
const base: CustomizationItem = {
  ...createItem("scope", "default"),
  id: "bugfix",
  runtimeId: "bugfix",
  title: "bugfix",
  owner: "core",
  content: "---\nname: bugfix\ndepth: Minimal\nkeywords: [fix]\n---\nScope instructions\n",
};
const items = [
  base,
  stage("workspace-scaffold", "initialization"),
  stage("workspace-detection", "initialization"),
  stage("state-init", "initialization"),
  stage("code-generation", "construction"),
  stage("build-and-test", "construction"),
  stage("requirements-analysis", "inception", ["feature"]),
];
const copy = () => duplicateScope(items, base, "my-hotfix", "my-team", "default");

describe("custom scopes", () => {
  it("copies the selected standard stages as adds.scopes and leaves original bytes intact", () => {
    const result = copy();
    expect(result.items.filter((item) => item.target?.contributionTo)).toHaveLength(2);
    expect(result.scope.content).toContain('baseScope: "bugfix"');
    for (const original of items)
      expect(result.items.find((item) => item.id === original.id)).toBe(original);
    expect(stageItems(result.items)).toHaveLength(6);
    expect(runsStage(required(items[1]), "my-hotfix", result.items)).toBe(true);
    expect(runsStage(required(items[6]), "my-hotfix", result.items)).toBe(false);
  });
  it("coalesces contributions for multiple scopes and removes only the chosen membership", () => {
    const first = copy();
    const second = duplicateScope(first.items, first.scope, "my-docs", "my-team", "default");
    expect(second.items.filter((item) => item.target?.contributionTo)).toHaveLength(2);
    const unchecked = setMembership(second.items, first.scope, required(items[4]), false);
    const addition = required(
      unchecked.find((item) => item.target?.contributionTo === "code-generation"),
    );
    expect(contributionScopes(addition)).toEqual(["my-docs"]);
    const removed = removeScope(unchecked, second.scope);
    expect(removed.some((item) => item.target?.contributionTo === "code-generation")).toBe(false);
    expect(removed.find((item) => item.id === required(items[4]).id)).toBe(items[4]);
  });
  it("edits custom stage scopes, preserves fixed initialization, and rejects invalid identities", () => {
    const result = copy();
    const own = {
      ...stage("my-team-review", "construction", []),
      owner: "plugin" as const,
      pluginId: "my-team",
    };
    const checked = setMembership([...result.items, own], result.scope, own, true);
    expect(
      listField(required(checked.find((item) => item.id === own.id)).content, "scopes"),
    ).toEqual(["my-hotfix"]);
    expect(setMembership(items, base, required(items[4]), false)).toBe(items);
    expect(setMembership(result.items, result.scope, required(items[1]), false)).toBe(result.items);
    expect(() => duplicateScope(result.items, base, "my-hotfix", "my-team", "default")).toThrow();
    expect(() => duplicateScope(items, base, "../escape", "my-team", "default")).toThrow();
    expect(() => createOwnedPlugin("core", "default")).toThrow();
    expect(
      JSON.parse(createOwnedPlugin("my-team", "default").content).aidlc.contributes.overlays,
    ).toBe("contributions/");
  });
  it("allows skipped prerequisites but reports missing references and cycles", () => {
    const source = stage("child", "construction", ["custom"]);
    const child = {
      ...source,
      content: setSourceField(source.content, "requires_stage", ["code-generation"]),
    };
    expect(stageDiagnostics([...items, child])).toEqual([]);
    expect(
      stageDiagnostics([
        { ...child, content: setSourceField(child.content, "requires_stage", ["missing"]) },
      ])[0]?.code,
    ).toBe("missing-stage");
    expect(
      stageDiagnostics([
        { ...child, content: setSourceField(child.content, "requires_stage", ["child"]) },
      ])[0]?.code,
    ).toBe("stage-cycle");
  });
});

it("matches the bundled reference section for all 33 standard stages", () => {
  expect(graph).toHaveLength(33);
  for (const stage of graph) {
    const doc = readFileSync(`docs/reference/ja/04-stages/${stage.phase}.md`, "utf8");
    const section = japaneseStageSection(doc, stage.number);
    expect(section, stage.slug).toMatch(
      new RegExp(`^## (?:ステージ|Stage) ${stage.number.replaceAll(".", "\\.")}(?:[:： \\t]|$)`),
    );
    expect(section?.match(/^## /gm)).toHaveLength(1);
  }
  expect(japaneseStageSection("## Stage 1.10: Other", "1.1")).toBeNull();
});

it.each(["scope", "stage", "agent", "sensor"] as const)(
  "keeps standard %s forms and raw source read only",
  (kind) => {
    const item = { ...createItem(kind, "default"), owner: "core" as const };
    render(<ItemEditor item={item} items={[item]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect((screen.getByLabelText("表示名") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("原文", { exact: true }));
    expect((screen.getByLabelText("設定の原文") as HTMLTextAreaElement).disabled).toBe(true);
  },
);

it("gives every concept and list card exactly one interactive heading link", () => {
  const props = {
    items,
    space: "default",
    category: null,
    changed: [],
    disabled: false,
    readOnly: false,
    diagnostics: [],
    onCategory: vi.fn(),
    onSelect: vi.fn(),
    onItems: vi.fn(),
    onRemove: vi.fn(),
    onDocument: vi.fn(),
  };
  const page = render(<CustomizationExplorer {...props} />);
  expect(screen.getAllByRole("article")).toHaveLength(6);
  for (const card of screen.getAllByRole("article")) {
    expect(within(card).getAllByRole("link")).toHaveLength(1);
    expect(card.querySelectorAll("a,button,input,select,textarea,[role=button]")).toHaveLength(1);
  }
  page.rerender(<CustomizationExplorer {...props} category="scopes" />);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(
    screen.getByRole("article").querySelectorAll("a,button,input,select,textarea"),
  ).toHaveLength(1);
});

it("fixes all initialization checkboxes and does not open a drawer when checking execution", () => {
  const result = copy();
  const onItems = vi.fn();
  render(
    <CustomizationExplorer
      items={result.items}
      space="default"
      category="scopes"
      selected={result.scope}
      changed={[]}
      disabled={false}
      readOnly={false}
      diagnostics={[]}
      onCategory={vi.fn()}
      onSelect={vi.fn()}
      onItems={onItems}
      onRemove={vi.fn()}
      onDocument={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "実行するステージ" }));
  for (const slug of ["workspace-scaffold", "workspace-detection", "state-init"])
    expect(
      screen.getByRole("checkbox", { name: `${slug} を実行` }).getAttribute("aria-disabled"),
    ).toBe("true");
  fireEvent.click(screen.getByRole("checkbox", { name: "code-generation を実行" }));
  expect(onItems).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "code-generation" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("has a current Japanese description for every bundled scope without translating custom or changed sources", () => {
  const files = readdirSync(".claude/scopes").filter((file) => /^aidlc-.*\.md$/.test(file));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const item = {
      ...base,
      runtimeId: file.slice(6, -3),
      content: readFileSync(`.claude/scopes/${file}`, "utf8"),
    };
    expect(japaneseScopeDescription(item), file).toMatch(/対象ステージ/);
    expect(japaneseScopeDescription({ ...item, owner: "plugin" })).toBeNull();
    expect(
      japaneseScopeDescription({ ...item, content: `${item.content}\nUpdated policy` }),
    ).toBeNull();
  }
});

it("opens scope settings in Japanese and switches to the original without changing settings", async () => {
  const scope = { ...base, content: readFileSync(".claude/scopes/aidlc-bugfix.md", "utf8") };
  const onItems = vi.fn();
  render(
    <CustomizationExplorer
      items={[scope, ...items.filter((item) => item.kind === "stage")]}
      selected={scope}
      space="default"
      category="scopes"
      changed={[]}
      disabled={false}
      readOnly={false}
      diagnostics={[]}
      onCategory={vi.fn()}
      onSelect={vi.fn()}
      onItems={onItems}
      onRemove={vi.fn()}
      onDocument={vi.fn()}
    />,
  );
  expect(screen.getByRole("tab", { name: "スコープ設定" }).getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(screen.getByRole("tab", { name: "日本語" }).getAttribute("aria-selected")).toBe("true");
  expect(await screen.findByText(/既存コードの特定のバグを/)).toBeTruthy();
  expect(
    screen.getByRole("textbox", { name: "本文・作業方針" }).getAttribute("contenteditable"),
  ).toBe("false");
  expect(screen.getByLabelText("ランナー").closest("details")).toBeNull();
  expect(screen.getByLabelText("自由記述の既定スコープ").closest("details")).toBeNull();
  expect(screen.queryByText("詳細設定", { exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "英語" }));
  expect(screen.getByRole("textbox", { name: "本文・作業方針" }).textContent).toContain(
    "Minimal depth for fixing one specific bug",
  );
  expect(
    screen.getByRole("textbox", { name: "本文・作業方針" }).getAttribute("contenteditable"),
  ).toBe("false");
  fireEvent.click(screen.getByRole("tab", { name: "実行するステージ" }));
  expect(screen.getByRole("button", { name: "code-generation" })).toBeTruthy();
  expect(onItems).not.toHaveBeenCalled();
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture");
  return value;
}
