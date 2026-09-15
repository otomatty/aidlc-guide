import type {
  CustomizationCatalog,
  CustomizationDraft,
  CustomizationItem,
} from "@aidlc-guide/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomizationPage from "../src/components/customization/CustomizationPage";
import { ImportDialog } from "../src/components/customization/PackageDialogs";
import { createItem, setSourceField } from "../src/components/customization/source-fields";
import { customizationApi } from "../src/services/customization";

const rule: CustomizationItem = {
  id: "rule",
  kind: "rule-section",
  title: "Development rules",
  owner: "project",
  content: "Current guidance",
  target: { layer: "team", heading: "Rules" },
};
const items: CustomizationItem[] = [
  rule,
  ...(["knowledge", "stage", "scope", "agent", "sensor", "tool", "plugin"] as const).map(
    (kind) => ({ ...createItem(kind, "default", "example"), id: kind }),
  ),
];
const catalog: CustomizationCatalog = {
  workspaceName: "fixture",
  spaceId: "default",
  spaces: ["default", "other"],
  engineVersion: "2.8.2",
  configurationRevision: "config",
  capabilities: {
    available: true,
    engineVersion: "2.8.2",
    protocolVersion: 1,
    canApply: true,
    canExportPlugin: true,
    canRecover: true,
  },
  hostMode: false,
  items,
  diagnostics: [],
};
let draft: CustomizationDraft;
let resize: ((width: number) => void) | undefined;
beforeEach(() => {
  draft = {
    schemaVersion: 1,
    id: "draft",
    revision: 1,
    spaceId: "default",
    baseConfigurationRevision: "config",
    engineVersion: "2.8.2",
    capabilityProfile: "all",
    updatedAt: "2026-09-15T00:00:00Z",
    baseItems: items,
    items: [...items],
    removedItemIds: [],
  };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        if (target.getAttribute("data-testid") === "customization-page")
          resize = (width) =>
            this.callback(
              [{ contentRect: { width } } as ResizeObserverEntry],
              this as unknown as ResizeObserver,
            );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(customizationApi, "catalog").mockResolvedValue(catalog);
  vi.spyOn(customizationApi, "draft").mockImplementation(async () => draft);
  vi.spyOn(customizationApi, "save").mockImplementation(async (body) => {
    const changed = new Map(draft.items.map((item) => [item.id, item]));
    for (const entry of body.changes)
      if (entry.operation === "remove") changed.delete(entry.itemId);
      else changed.set(entry.item.id, entry.item);
    draft = { ...draft, revision: draft.revision + 1, items: [...changed.values()] };
    return draft;
  });
  vi.spyOn(customizationApi, "tools").mockResolvedValue([
    { tool: "claude", label: "Claude Code", available: true },
    { tool: "cursor", label: "Cursor", available: true },
    { tool: "copilot", label: "GitHub Copilot", available: true },
  ]);
  vi.spyOn(customizationApi, "materials").mockResolvedValue([
    { id: "material-1", title: "要件成果物", origin: "workflow" },
  ]);
  vi.spyOn(customizationApi, "conversation").mockResolvedValue({ draftId: "draft", jobs: [] });
  vi.spyOn(customizationApi, "pendingOperation").mockResolvedValue(null);
  vi.spyOn(customizationApi, "apply").mockResolvedValue({
    id: "operation",
    requestId: "request",
    kind: "apply",
    status: "completed",
  });
  vi.spyOn(customizationApi, "adopt").mockImplementation(async () => {
    draft = {
      ...draft,
      revision: draft.revision + 1,
      items: draft.items.map((item) =>
        item.id === rule.id ? { ...item, content: "AI proposal" } : item,
      ),
    };
    return draft;
  });
});
afterEach(() => {
  resize = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("customization page", () => {
  it("offers working form fields in all six categories and identifies rule layers", async () => {
    render(<CustomizationPage open hostMode={false} />);
    expect(await screen.findByLabelText("章見出し")).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Development rules · チーム · ルールの章" }),
    ).toBeTruthy();
    for (const [category, label] of [
      ["knowledge", "ファイル名"],
      ["workflow", "主担当エージェント"],
      ["agents", "専門性・説明"],
      ["quality", "チェックコマンド"],
      ["plugins", "プラグイン名"],
    ] as const) {
      fireEvent.change(screen.getByLabelText("カテゴリ"), { target: { value: category } });
      expect(await screen.findByLabelText(label)).toBeTruthy();
    }
    fireEvent.change(screen.getByLabelText("プラグイン名"), {
      target: { value: "changed-plugin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
    await waitFor(() => expect(customizationApi.save).toHaveBeenCalled());
    expect(draft.items.find((item) => item.id === "plugin")?.content).toContain(
      '"name": "changed-plugin"',
    );
    expect(customizationApi.apply).not.toHaveBeenCalled();
  });
  it("keeps form and chat DOM/input through narrow tabs and resize", async () => {
    render(<CustomizationPage open hostMode={false} />);
    const body = await screen.findByLabelText("本文・作業方針");
    fireEvent.change(body, { target: { value: "Unfinished draft" } });
    act(() => resize?.(500));
    fireEvent.click(screen.getByRole("tab", { name: "AIチャット" }));
    const message = screen.getByLabelText("相談・変更の依頼");
    fireEvent.change(message, { target: { value: "Consider a review step" } });
    expect(screen.queryByRole("textbox", { name: "本文・作業方針" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "編集" }));
    expect(screen.getByLabelText("本文・作業方針")).toBe(body);
    expect((body as HTMLTextAreaElement).value).toBe("Unfinished draft");
    act(() => resize?.(1150));
    expect(screen.getByLabelText("相談・変更の依頼")).toBe(message);
    expect((message as HTMLTextAreaElement).value).toBe("Consider a review step");
    expect(screen.getByRole("navigation", { name: "カスタマイズのカテゴリ" })).toBeTruthy();
  });
  it("flushes edits before a diff and only applies on the separate manual action", async () => {
    vi.mocked(customizationApi.apply).mockImplementation(async () => {
      draft = { ...draft, revision: draft.revision + 1, baseItems: draft.items };
      return { id: "applied", requestId: "request", kind: "apply", status: "completed" };
    });
    vi.spyOn(customizationApi, "plan").mockImplementation(async () => ({
      id: "plan",
      draftId: draft.id,
      draftRevision: draft.revision,
      configurationRevision: "config",
      canApply: true,
      createdAt: "now",
      diagnostics: [],
      files: [
        {
          relativePath: "memory/team.md",
          beforeHash: "a",
          afterHash: "b",
          before: rule.content,
          after: draft.items[0]?.content,
          itemIds: [rule.id],
        },
      ],
    }));
    render(<CustomizationPage open hostMode={false} />);
    fireEvent.change(await screen.findByLabelText("本文・作業方針"), {
      target: { value: "New guidance" },
    });
    fireEvent.click(screen.getByRole("button", { name: "変更を確認" }));
    await screen.findByRole("dialog");
    expect(customizationApi.save).toHaveBeenCalledTimes(1);
    expect(customizationApi.plan).toHaveBeenCalledWith(
      expect.objectContaining({ expectedDraftRevision: 2 }),
    );
    expect(customizationApi.apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() =>
      expect(customizationApi.apply).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedDraftRevision: 2,
          planId: "plan",
          configurationRevision: "config",
        }),
      ),
    );
    await screen.findByText("適用が完了しました。");
    expect(screen.queryByText(/確認を始めた後に下書きが変わりました/)).toBeNull();
  });
  it("leaves completed AI proposals untouched until explicit adoption", async () => {
    vi.mocked(customizationApi.conversation).mockResolvedValue({
      draftId: "draft",
      jobs: [
        {
          id: "job",
          requestId: "req",
          draftId: "draft",
          draftRevision: 1,
          configurationRevision: "config",
          tool: "claude",
          message: "Improve guidance",
          phase: "completed",
          answer: "提案しました",
          createdAt: "now",
          updatedAt: "now",
          proposal: {
            id: "proposal",
            summary: "改善案",
            draftId: "draft",
            draftRevision: 1,
            configurationRevision: "config",
            createdAt: "now",
            changes: [{ operation: "replace", item: { ...rule, content: "AI proposal" } }],
          },
        },
      ],
    });
    render(<CustomizationPage open hostMode={false} />);
    await screen.findByRole("button", { name: "下書きに取り込む" });
    expect(customizationApi.adopt).not.toHaveBeenCalled();
    expect((screen.getByLabelText("本文・作業方針") as HTMLTextAreaElement).value).toBe(
      rule.content,
    );
    fireEvent.click(screen.getByRole("button", { name: "下書きに取り込む" }));
    await waitFor(() =>
      expect(customizationApi.adopt).toHaveBeenCalledWith(
        expect.objectContaining({ proposalId: "proposal", expectedDraftRevision: 1 }),
      ),
    );
    expect((screen.getByLabelText("本文・作業方針") as HTMLTextAreaElement).value).toBe(
      "AI proposal",
    );
    expect(customizationApi.apply).not.toHaveBeenCalled();
  });
  it("keeps forms and AI out of write mode for a shared host", async () => {
    vi.mocked(customizationApi.catalog).mockResolvedValue({ ...catalog, hostMode: true });
    render(<CustomizationPage open hostMode />);
    const body = await screen.findByLabelText("本文・作業方針");
    expect((body as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "下書きを保存" })).toBeNull();
    expect(screen.queryByRole("button", { name: "送信" })).toBeNull();
    expect(customizationApi.draft).not.toHaveBeenCalled();
    expect(customizationApi.tools).not.toHaveBeenCalled();
  });
  it("updates a referenced stage from the scope assignment form", async () => {
    const scope = items.find((item) => item.id === "scope");
    if (!scope) throw new Error("fixture missing");
    draft.items = draft.items.map((item) =>
      item.id === "stage" ? { ...item, content: setSourceField(item.content, "scopes", []) } : item,
    );
    render(<CustomizationPage open hostMode={false} />);
    await screen.findByLabelText("カテゴリ");
    fireEvent.change(screen.getByLabelText("カテゴリ"), { target: { value: "workflow" } });
    fireEvent.change(screen.getByLabelText("編集する項目（2件）"), { target: { value: "scope" } });
    fireEvent.click(screen.getByText(/この設定を使う工程/));
    fireEvent.click(screen.getByRole("checkbox", { name: "新しい工程" }));
    fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
    await waitFor(() => expect(customizationApi.save).toHaveBeenCalled());
    expect(draft.items.find((item) => item.id === "stage")?.content).toContain(scope.runtimeId);
  });
});

it("imports only explicitly selected items with the chosen replacement target", () => {
  const onAdopt = vi.fn();
  render(
    <ImportDialog
      plan={{
        id: "import",
        draftId: draft.id,
        draftRevision: draft.revision,
        diagnostics: [],
        entries: [
          {
            sourceId: "first",
            item: rule,
            matchId: rule.id,
            action: "replace",
            candidates: [rule.id],
          },
          {
            sourceId: "second",
            item: { ...rule, title: "Unselected" },
            matchId: null,
            action: "add",
            candidates: [],
          },
        ],
      }}
      items={items}
      draft={draft}
      dirty={false}
      busy={false}
      onClose={() => {}}
      onAdopt={onAdopt}
    />,
  );
  const adopt = screen.getByRole("button", { name: "選んだ項目を下書きへ取り込む" });
  expect((adopt as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Development rules · チーム · ルールの章" }),
  );
  fireEvent.click(adopt);
  expect(onAdopt).toHaveBeenCalledWith([{ sourceId: "first", targetId: "rule" }]);
});
