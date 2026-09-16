import type {
  CustomizationCatalog,
  CustomizationDraft,
  CustomizationItem,
} from "@aidlc-guide/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomizationPage from "../src/components/customization/CustomizationPage";
import { ImportDialog } from "../src/components/customization/PackageDialogs";
import {
  CATEGORIES,
  createItem,
  setSourceField,
} from "../src/components/customization/source-fields";
import { customizationApi } from "../src/services/customization";
import { chooseOption } from "./choose-option";

it("rejects imports above the shared JSON limit before reading them", async () => {
  const analyze = vi.spyOn(customizationApi, "importAnalyze");
  render(<CustomizationPage open hostMode={false} />);
  await screen.findByLabelText("本文・作業方針");
  const file = new File([], "too-large.json");
  const read = vi.fn();
  Object.defineProperties(file, {
    size: { value: 70 * 1024 * 1024 + 1 },
    text: { value: read },
  });
  fireEvent.change(screen.getByLabelText("Guide設定ファイル"), { target: { files: [file] } });
  expect(await screen.findByText("設定ファイルは70 MB以下にしてください。")).toBeTruthy();
  expect(read).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
});

it("warns before leaving with debounced edits and stops warning once saved", async () => {
  const page = render(<CustomizationPage open hostMode={false} />);
  const input = await screen.findByLabelText("本文・作業方針");
  const leave = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(leave()).toBe(false);
  fireEvent.change(input, { target: { value: "unsaved input" } });
  expect(leave()).toBe(true);
  await waitFor(() => expect(customizationApi.save).toHaveBeenCalled());
  await waitFor(() => expect(leave()).toBe(false));
  page.unmount();
  expect(leave()).toBe(false);
});

it("passes a Guide export above 25 MB to server validation", async () => {
  const analyze = vi
    .spyOn(customizationApi, "importAnalyze")
    .mockRejectedValue(new Error("server reached"));
  render(<CustomizationPage open hostMode={false} />);
  await screen.findByLabelText("本文・作業方針");
  const content = { schemaVersion: 1, items: [], padding: "a".repeat(27 * 1024 * 1024) };
  const text = JSON.stringify(content);
  const file = new File([text], "export.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => text });
  fireEvent.change(screen.getByLabelText("Guide設定ファイル"), { target: { files: [file] } });
  await waitFor(() => expect(analyze).toHaveBeenCalled());
  expect(analyze.mock.calls[0]?.[0].package).toEqual(content);
});

it("explains malformed Guide JSON in Japanese before saving or analyzing the import", async () => {
  const analyze = vi.spyOn(customizationApi, "importAnalyze");
  render(<CustomizationPage open hostMode={false} />);
  await screen.findByLabelText("本文・作業方針");
  const file = new File(["invalid"], "invalid.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => "invalid" });
  fireEvent.change(screen.getByLabelText("Guide設定ファイル"), { target: { files: [file] } });
  expect(
    await screen.findByText(
      "設定ファイルのJSONを読み取れません。Guideから書き出した有効なJSONファイルを選択してください。",
    ),
  ).toBeTruthy();
  expect(analyze).not.toHaveBeenCalled();
  expect(customizationApi.save).not.toHaveBeenCalled();
});

const rule: CustomizationItem = {
  id: "rule",
  kind: "rule-section",
  title: "Development rules",
  owner: "project",
  content: "Current guidance",
  target: { layer: "team", heading: "Rules" },
};

it("offers only compatible knowledge types as import replacement targets", async () => {
  const team: CustomizationItem = {
    ...createItem("knowledge", "default"),
    id: "team",
    title: "Team notes",
  };
  const document: CustomizationItem = {
    ...team,
    id: "document",
    title: "Document",
    target: { knowledgeType: "document-source", filename: "document.pdf" },
  };
  render(
    <ImportDialog
      plan={{
        id: "import",
        draftId: draft.id,
        draftRevision: draft.revision,
        diagnostics: [],
        entries: [
          {
            sourceId: "incoming",
            item: team,
            matchId: null,
            action: "choose-target",
            candidates: [team.id],
          },
        ],
      }}
      items={[team, document]}
      draft={draft}
      dirty={false}
      busy={false}
      onClose={() => {}}
      onAdopt={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("combobox", { name: "取り込み先" }));
  expect(screen.getByRole("option", { name: /Team notes.*置き換える/ })).toBeTruthy();
  expect(screen.queryByRole("option", { name: /Document.*置き換える/ })).toBeNull();
});
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
  vi.spyOn(customizationApi, "pendingOperation").mockResolvedValue(null);
  vi.spyOn(customizationApi, "apply").mockResolvedValue({
    id: "operation",
    requestId: "request",
    kind: "apply",
    status: "completed",
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
    expect(screen.getByRole("combobox", { name: /編集する項目/ }).textContent).toContain(
      "Development rules · チーム · ルールの章",
    );
    for (const [category, label] of [
      ["knowledge", "ファイル名"],
      ["workflow", "主担当エージェント"],
      ["agents", "専門性・説明"],
      ["quality", "チェックコマンド"],
      ["plugins", "プラグイン名"],
    ] as const) {
      await chooseOption(
        "カテゴリ",
        CATEGORIES.find((entry) => entry.id === category)?.label ?? category,
      );
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
  it("keeps the editor and its input visible through narrow and wide layouts", async () => {
    render(<CustomizationPage open hostMode={false} />);
    const body = await screen.findByLabelText("本文・作業方針");
    fireEvent.change(body, { target: { value: "Unfinished draft" } });
    act(() => resize?.(500));
    expect(screen.queryByRole("tab", { name: "AIチャット" })).toBeNull();
    expect(screen.queryByLabelText("相談・変更の依頼")).toBeNull();
    expect(screen.getByLabelText("本文・作業方針")).toBe(body);
    expect((body as HTMLTextAreaElement).value).toBe("Unfinished draft");
    act(() => resize?.(1150));
    expect(screen.queryByRole("region", { name: "カスタマイズAIチャット" })).toBeNull();
    expect(screen.getByLabelText("本文・作業方針")).toBe(body);
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
  it("keeps forms out of write mode for a shared host", async () => {
    vi.mocked(customizationApi.catalog).mockResolvedValue({ ...catalog, hostMode: true });
    render(<CustomizationPage open hostMode />);
    const body = await screen.findByLabelText("本文・作業方針");
    expect((body as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "下書きを保存" })).toBeNull();
    expect(screen.queryByRole("button", { name: "送信" })).toBeNull();
    expect(customizationApi.draft).not.toHaveBeenCalled();
  });
  it("updates a referenced stage from the scope assignment form", async () => {
    const scope = items.find((item) => item.id === "scope");
    if (!scope) throw new Error("fixture missing");
    draft.items = draft.items.map((item) =>
      item.id === "stage" ? { ...item, content: setSourceField(item.content, "scopes", []) } : item,
    );
    render(<CustomizationPage open hostMode={false} />);
    await screen.findByLabelText("カテゴリ");
    await chooseOption("カテゴリ", "ワークフロー");
    await chooseOption("編集する項目（2件）", /新しいスコープ/);
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
