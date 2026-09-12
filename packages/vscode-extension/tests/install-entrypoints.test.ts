import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import type { HarnessId } from "../src/harness-detect.ts";
import type { SetupSnapshot } from "../src/setup-state.ts";

const mocks = vi.hoisted(() => ({
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  create: vi.fn(),
  inspect: vi.fn(),
  install: vi.fn(),
  configure: vi.fn(),
  workspace: { isTrusted: true, workspaceFolders: [] as { uri: { fsPath: string } }[] },
}));
vi.mock("vscode", () => ({
  commands: {
    registerCommand: (id: string, run: (...args: unknown[]) => unknown) => {
      mocks.commands.set(id, run);
      return { dispose: vi.fn() };
    },
    executeCommand: (id: string, ...args: unknown[]) => mocks.commands.get(id)?.(...args),
  },
  env: { appName: "Cursor" },
  Uri: { file: (fsPath: string) => ({ fsPath }), parse: (value: string) => value },
  ViewColumn: { One: 1 },
  window: { createWebviewPanel: mocks.create, showErrorMessage: vi.fn() },
  workspace: Object.assign(mocks.workspace, {
    onDidChangeWorkspaceFolders: () => ({ dispose: vi.fn() }),
    onDidGrantWorkspaceTrust: () => ({ dispose: vi.fn() }),
  }),
}));
vi.mock("../src/commands.ts", () => ({
  askOneShot: vi.fn(),
  launchBtw: vi.fn(),
  shareOnLan: vi.fn(),
  runInTerminal: vi.fn(),
}));
vi.mock("../src/dashboard-html.ts", () => ({ loadDashboardHtml: async () => "<html></html>" }));
vi.mock("../src/doctor.ts", () => ({ onPath: vi.fn(), runDoctor: vi.fn() }));
vi.mock("../src/guide-session.ts", () => ({
  acquireSession: () => ({ session: { subscribe: () => vi.fn() }, dispose: vi.fn() }),
  persistSelectedIntent: vi.fn(),
  disposeAllSessions: vi.fn(),
}));
vi.mock("../src/mcp-register.ts", () => ({
  docsSkillPath: vi.fn(),
  mcpScriptPath: vi.fn(),
  registerMcp: vi.fn(),
  refreshDocsRegistration: vi.fn(),
}));
vi.mock("../src/native-setup.ts", async (original) => ({
  ...(await original<typeof import("../src/native-setup.ts")>()),
  readNativeInstall: () => ({ executable: "aidlc", version: "2.8.1", binDir: "bin" }),
  readVersionedNativeInstall: () => ({ executable: "aidlc", version: "2.8.1", binDir: "bin" }),
  installNative: mocks.install,
  configureNative: mocks.configure,
}));
vi.mock("../src/setup-state.ts", async (original) => ({
  ...(await original<typeof import("../src/setup-state.ts")>()),
  inspectSetup: mocks.inspect,
}));
vi.mock("../src/status-bar.ts", () => ({
  createStatusBar: vi.fn(),
  startStatusBarRefresh: vi.fn(),
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
  openWorkflowsUpdatePanel: vi.fn(),
  UPDATE_WORKFLOWS_COMMAND: "aidlc-guide.updateWorkflows",
}));
vi.mock("../src/write-global-vsix.ts", () => ({ registerApplyLatestCommand: vi.fn() }));

import { openDashboardPanel } from "../src/dashboard-panel.ts";
import { activate } from "../src/extension.ts";

function panelFixture(viewType: string) {
  const cleanups: (() => void)[] = [];
  const panel = {
    viewType,
    receive: async (_message: unknown) => {},
    webview: {
      html: "",
      postMessage: vi.fn(),
      onDidReceiveMessage: (receive: (message: unknown) => Promise<void>) => {
        panel.receive = receive;
        return { dispose: vi.fn() };
      },
    },
    onDidDispose: (callback: () => void) => {
      cleanups.push(callback);
      return { dispose: vi.fn() };
    },
    dispose: () => {
      for (const cleanup of cleanups) cleanup();
    },
  };
  return panel;
}

let root: string;
let context: ExtensionContext;
let panels: ReturnType<typeof panelFixture>[];
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.commands.clear();
  mocks.workspace.workspaceFolders = [];
  panels = [];
  mocks.create.mockImplementation((type: string) => {
    const panel = panelFixture(type);
    panels.push(panel);
    return panel;
  });
  mocks.configure.mockResolvedValue({ doctorOk: true, details: "正常" });
  context = {
    extensionPath: "extension",
    subscriptions: [],
    workspaceState: { get: vi.fn(), update: vi.fn() },
  } as unknown as ExtensionContext;
  await activate(context);
  root = mkdtempSync(path.join(tmpdir(), "aidlc-entrypoints-"));
  mocks.workspace.workspaceFolders = [{ uri: { fsPath: root } }];
});
afterEach(() => {
  for (const panel of panels) panel.dispose();
  rmSync(root, { recursive: true, force: true });
});

describe.each(["dashboard", "command palette", "onboarding"])("install guard via %s", (entry) => {
  it.each([
    {
      name: "new multiple selection",
      installed: false,
      selected: ["claude", "cursor"],
      blocked: true,
    },
    { name: "additional harness", installed: true, selected: ["cursor"], blocked: true },
    { name: "new single harness", installed: false, selected: ["claude"], blocked: false },
    { name: "existing single harness", installed: true, selected: ["claude"], blocked: false },
  ])("handles $name through the real shared service", async ({ installed, selected, blocked }) => {
    if (installed) {
      const data = path.join(root, ".claude", "tools", "data");
      mkdirSync(data, { recursive: true });
      writeFileSync(
        path.join(data, "aidlc-stamp.json"),
        JSON.stringify({
          schemaVersion: 1,
          distribution: "claude",
          frameworkVersion: "2.8.1",
        }),
      );
    }
    mocks.inspect.mockResolvedValue({
      root,
      configured: installed,
      projectPresent: installed,
      native: null,
      version: installed ? "2.8.1" : null,
      harnesses: installed ? ["claude"] : [],
      docsReady: false,
      preference: undefined,
    } satisfies SetupSnapshot);
    if (entry === "dashboard") {
      openDashboardPanel(context, root);
      await panels[0]?.receive({ type: "open-workflows-install" });
    } else {
      mocks.commands.get(
        entry === "onboarding" ? "aidlc-guide.setup" : "aidlc-guide.installWorkflows",
      )?.();
    }
    const viewType = entry === "onboarding" ? "aidlcGuide.setup" : "aidlcGuide.workflowsInstall";
    await vi.waitFor(() =>
      expect(panels.find((panel) => panel.viewType === viewType)?.webview.html).toContain("AI-DLC"),
    );
    const panel = panels.find((panel) => panel.viewType === viewType);
    if (!panel) throw new Error("installer panel missing");
    // A forged/stale webview message must hit the service guard even if UI controls are disabled.
    await panel.receive({ type: "install", harnesses: selected as HarnessId[] });
    expect(mocks.install).not.toHaveBeenCalled();
    if (blocked) {
      expect(mocks.configure).not.toHaveBeenCalled();
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "status",
          error: true,
          text: expect.stringContaining("一括設定"),
        }),
      );
    } else {
      expect(mocks.configure).toHaveBeenCalledTimes(installed ? 0 : 1);
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "status",
          error: false,
          text: expect.stringContaining("準備が完了"),
        }),
      );
    }
  });
});
