import type { BundledPluginCatalog } from "@aidlc-guide/shared-types";
import { BUNDLED_PLUGINS } from "@aidlc-guide/shared-types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PluginsPanel } from "@/features/plugins/PluginsPage.tsx";
import { StoreProvider } from "@/store/context.tsx";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect/></svg>';

const catalog: BundledPluginCatalog = {
  schemaVersion: 1,
  plugins: [
    {
      name: "focus",
      version: "0.1.0",
      sourceHash: `sha256:${"0".repeat(64)}`,
      title: "focus",
      tagline: "チケット1枚から実装まで。",
      summary: "要件から TDD の実装まで進めます。",
      status: "preview",
      harness: "claude",
      scope: "focus-flow",
      startCommand: "/aidlc --scope focus-flow <チケット番号> <要約>",
      fitFor: ["Jira を使っている"],
      notFitFor: ["Claude Code を使っていない"],
      requirements: [
        {
          id: "atlassian-mcp",
          level: "recommended",
          label: "Atlassian の MCP",
          detail: "なくても進められます。",
        },
        { id: "opus", level: "info", label: "Claude Opus", detail: "テストと実装で使います。" },
      ],
      stages: [
        {
          slug: "requirements-analysis",
          name: "Requirements Analysis",
          phase: "inception",
          origin: "core-extended",
          perUnit: false,
        },
        {
          slug: "units-generation",
          name: "Units Generation",
          phase: "inception",
          origin: "core",
          perUnit: false,
        },
        {
          slug: "focus-test",
          name: "テスト先行",
          phase: "construction",
          origin: "plugin",
          perUnit: true,
        },
      ],
      files: {
        added: [
          ".claude/aidlc-common/stages/construction/focus-test.md",
          ".claude/agents/focus-builder-agent.md",
        ],
        changed: [".claude/aidlc-common/stages/inception/requirements-analysis.md"],
      },
      sample: { alt: "見本の図", svg: SVG },
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function view(plugins: BundledPluginCatalog = catalog): void {
  render(
    <StoreProvider preloaded={{ route: { name: "plugins" } }}>
      <PluginsPanel catalog={plugins} />
    </StoreProvider>,
  );
}

describe("PluginsPanel", () => {
  it("lists the bundled plugins with what each promises, marking a preview", () => {
    view();
    expect(screen.getByRole("heading", { name: "プラグイン" })).toBeDefined();
    expect(screen.getByText(/決まった進め方を追加します/)).toBeDefined();
    const card = screen.getByTestId("plugin-card-focus");
    expect(within(card).getByText("focus")).toBeDefined();
    expect(within(card).getByText("チケット1枚から実装まで。")).toBeDefined();
    expect(within(card).getByText("試験版")).toBeDefined();
    expect(within(card).getByText("v0.1.0")).toBeDefined();
  });

  it("says installing is not offered yet, and offers no button that does nothing", () => {
    view();
    expect(screen.getByTestId("plugins-install-pending").textContent).toContain("準備中");
    expect(screen.queryByRole("button", { name: /導入|有効|無効|更新する/ })).toBeNull();
  });

  it("shows what changes before anything is installed", async () => {
    view();
    await userEvent.click(screen.getByRole("button", { name: /focus の詳細/ }));
    const detail = screen.getByTestId("plugin-detail-focus");

    const flow = within(detail).getByTestId("plugin-stages");
    const rows = within(flow).getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("data-origin"))).toEqual([
      "core-extended",
      "core",
      "plugin",
    ]);
    // Never by color alone: every changed stage says so in words.
    expect(rows[0]?.textContent).toContain("手順を追記");
    expect(rows[2]?.textContent).toContain("追加");
    expect(rows[2]?.textContent).toContain("Unit ごと");

    const sample = within(detail).getByRole("img", { name: "見本の図" });
    expect(sample.getAttribute("src")).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`,
    );

    expect(within(detail).getByText("Jira を使っている")).toBeDefined();
    expect(within(detail).getByText("Claude Code を使っていない")).toBeDefined();
    const needs = within(detail).getByTestId("plugin-requirements");
    expect(needs.textContent).toContain("推奨");
    expect(needs.textContent).toContain("Atlassian の MCP");

    const files = within(detail).getByTestId("plugin-files");
    expect(files.textContent).toContain("追加されるファイル（2 件）");
    expect(files.textContent).toContain("変更されるファイル（1 件）");
    expect(files.textContent).toContain(".claude/agents/focus-builder-agent.md");
    expect(files.textContent).toContain("アプリケーションのコードは変えません");

    expect(
      within(detail).getByText("/aidlc --scope focus-flow <チケット番号> <要約>"),
    ).toBeDefined();

    await userEvent.click(within(detail).getByRole("button", { name: "一覧に戻る" }));
    expect(screen.queryByTestId("plugin-detail-focus")).toBeNull();
    expect(screen.getByTestId("plugin-card-focus")).toBeDefined();
  });

  it("explains an empty catalog", () => {
    view({ schemaVersion: 1, plugins: [] });
    expect(screen.getByTestId("plugins-empty")).toBeDefined();
  });

  it("shows focus from the catalog the extension ships", () => {
    view(BUNDLED_PLUGINS);
    expect(screen.getByTestId("plugin-card-focus")).toBeDefined();
  });
});
