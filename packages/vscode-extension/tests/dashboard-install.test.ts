import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  receive: vi.fn(),
  gateAction: vi.fn(),
}));
vi.mock("vscode", () => ({
  commands: { executeCommand: mocks.execute },
  env: {},
  Uri: { file: (fsPath: string) => ({ fsPath }) },
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: () => ({
      webview: { html: "", onDidReceiveMessage: mocks.receive },
      onDidDispose: vi.fn(),
    }),
  },
}));
// No video packs installed: discovery reads the real extension registry.
vi.mock("../src/video-packs.ts", () => ({
  installedVideoPacks: () => [],
  onVideoPacksChanged: () => ({ dispose: vi.fn() }),
  videoPackRoots: () => [],
}));
vi.mock("../src/commands.ts", () => ({ runInTerminal: vi.fn() }));
vi.mock("../src/dashboard-html.ts", () => ({ loadDashboardHtml: async () => "<html></html>" }));
vi.mock("../src/doctor.ts", () => ({ onPath: vi.fn() }));
vi.mock("../src/guide-session.ts", () => ({
  acquireSession: () => ({
    session: { subscribe: () => vi.fn() },
    dispose: vi.fn(),
  }),
  persistSelectedIntent: vi.fn(),
}));
vi.mock("../src/official-docs-root.ts", () => ({ resolveOfficialDocsRoot: () => "docs" }));
vi.mock("../src/open-file.ts", () => ({ openFileRef: vi.fn() }));
vi.mock("../src/open-official-doc.ts", () => ({
  getLastOfficialDocsLocale: vi.fn(),
  handleOpenOfficialDoc: vi.fn(),
  injectDocsShellDeepLink: vi.fn(),
  OFFICIAL_DOCS_LOCALE_KEY: "locale",
}));
vi.mock("../src/workflows-update-panel.ts", () => ({
  maybePromptWorkflowsUpdate: vi.fn(),
  runVersionGateAction: mocks.gateAction,
}));
vi.mock("../src/write-global-vsix.ts", () => ({ registerApplyLatestCommand: vi.fn() }));

import { openDashboardPanel } from "../src/dashboard-panel.ts";

beforeEach(() => vi.clearAllMocks());

describe("dashboard workflows installation", () => {
  it("opens setup for the host's dashboard root without accepting a webview path", async () => {
    openDashboardPanel(
      { extensionPath: "extension", subscriptions: [] } as unknown as ExtensionContext,
      "dashboard-project",
    );
    await mocks.receive.mock.calls[0]?.[0]({
      type: "open-workflows-setup",
      workspaceRoot: "unrelated-project",
    });
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("aidlc-guide.setup", "dashboard-project");
  });

  it("opens updates for the host's dashboard root without accepting a webview path", async () => {
    openDashboardPanel(
      { extensionPath: "extension", subscriptions: [] } as unknown as ExtensionContext,
      "dashboard-project",
    );
    await mocks.receive.mock.calls[0]?.[0]({
      type: "open-workflows-update",
      workspaceRoot: "unrelated-project",
    });
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(
      "aidlc-guide.updateWorkflows",
      "dashboard-project",
    );
  });
  it("uses the host's dashboard workspace even when the message supplies a different path", async () => {
    openDashboardPanel(
      { extensionPath: "extension", subscriptions: [] } as unknown as ExtensionContext,
      "dashboard-project",
    );
    const receive = mocks.receive.mock.calls[0]?.[0];
    await receive({ type: "open-workflows-install", workspaceRoot: "unrelated-project" });
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(
      "aidlc-guide.installWorkflows",
      "dashboard-project",
    );
  });

  it("runs the version check's action for the host's dashboard root", async () => {
    const context = { extensionPath: "extension", subscriptions: [] } as unknown as ExtensionContext;
    openDashboardPanel(context, "dashboard-project");
    const receive = mocks.receive.mock.calls[0]?.[0];
    await receive({ type: "version-gate-action", action: "update-project", root: "elsewhere" });
    expect(mocks.gateAction).toHaveBeenCalledExactlyOnceWith(
      context,
      "dashboard-project",
      "update-project",
    );
  });

  it("ignores an action the version check does not offer", async () => {
    openDashboardPanel(
      { extensionPath: "extension", subscriptions: [] } as unknown as ExtensionContext,
      "dashboard-project",
    );
    const receive = mocks.receive.mock.calls[0]?.[0];
    await receive({ type: "version-gate-action", action: "uninstall" });
    await receive({ type: "version-gate-action", action: 1 });
    expect(mocks.gateAction).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
