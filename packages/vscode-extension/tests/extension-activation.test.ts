import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  setup: vi.fn(),
  inspect: vi.fn(),
  docsRefresh: vi.fn(),
  updatePrompt: vi.fn(),
  refresh: vi.fn(),
  status: vi.fn(),
  error: vi.fn(),
  folders: vi.fn(),
  trust: vi.fn(),
  closeSessions: vi.fn(),
  workspace: {
    workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
    isTrusted: true,
  },
}));
vi.mock("vscode", () => ({
  commands: { registerCommand: mocks.register },
  window: { showErrorMessage: mocks.error },
  workspace: Object.assign(mocks.workspace, {
    onDidChangeWorkspaceFolders: mocks.folders,
    onDidGrantWorkspaceTrust: mocks.trust,
  }),
}));
vi.mock("../src/commands.ts", () => ({
  askOneShot: vi.fn(),
  launchBtw: vi.fn(),
  shareOnLan: vi.fn(),
}));
vi.mock("../src/dashboard-panel.ts", () => ({ openDashboardPanel: vi.fn() }));
vi.mock("../src/guide-session.ts", () => ({
  disposeAllSessions: vi.fn(),
  closeAllSessions: mocks.closeSessions,
}));
vi.mock("../src/mcp-register.ts", () => ({
  docsSkillPath: (root: string) => `${root}/docs-skill`,
  mcpScriptPath: (root: string) => `${root}/dist/aidlc-mcp.mjs`,
  refreshDocsRegistration: mocks.docsRefresh,
  registerMcp: vi.fn(),
}));
vi.mock("../src/setup-panel.ts", () => ({
  maybePromptSetup: mocks.setup,
  openSetupPanel: vi.fn(),
  openWorkflowsInstallPanel: vi.fn(),
}));
vi.mock("../src/setup-state.ts", () => ({
  inspectSetup: mocks.inspect,
  needsSetup: (state: { incomplete: boolean }) => state.incomplete,
  setupStateKey: (root: string) => root,
}));
vi.mock("../src/status-bar.ts", () => ({
  createStatusBar: mocks.status,
  startStatusBarRefresh: mocks.refresh,
}));
vi.mock("../src/workflows-update-panel.ts", () => ({
  maybePromptWorkflowsUpdate: mocks.updatePrompt,
  openWorkflowsUpdatePanel: vi.fn(),
  UPDATE_WORKFLOWS_COMMAND: "aidlc-guide.updateWorkflows",
}));

import { activate, deactivate } from "../src/extension.ts";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.workspaceFolders = undefined;
  mocks.workspace.isTrusted = true;
  mocks.setup.mockResolvedValue(true);
  mocks.inspect.mockResolvedValue({ incomplete: true });
  mocks.docsRefresh.mockResolvedValue({ complete: true, updated: false });
  mocks.refresh.mockReturnValue({ dispose: vi.fn() });
  mocks.closeSessions.mockResolvedValue(undefined);
});

describe("deactivation", () => {
  it.each([false, true])(
    "returns the pending session shutdown, including failure=%s",
    async (fails) => {
      let finish = () => {};
      const failure = new Error("AI shutdown timed out");
      const closing = new Promise<void>((resolve, reject) => {
        finish = () => (fails ? reject(failure) : resolve());
      });
      mocks.closeSessions.mockReturnValue(closing);
      const deactivated = deactivate();
      expect(deactivated).toBe(closing);
      const result = fails
        ? expect(deactivated).rejects.toBe(failure)
        : expect(deactivated).resolves.toBeUndefined();
      finish();
      await result;
    },
  );
});
describe("first-run activation", () => {
  it("keeps setup closed on startup and after trust is granted", async () => {
    const { openSetupPanel } = await import("../src/setup-panel.ts");
    const { openDashboardPanel } = await import("../src/dashboard-panel.ts");
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "new-project" } }];
    mocks.workspace.isTrusted = false;
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    expect(mocks.docsRefresh).not.toHaveBeenCalled();
    mocks.workspace.isTrusted = true;
    mocks.trust.mock.calls[0]?.[0]();
    await vi.waitFor(() => expect(mocks.inspect).toHaveBeenCalled());
    expect(mocks.setup).not.toHaveBeenCalled();
    expect(openSetupPanel).not.toHaveBeenCalled();
    expect(openDashboardPanel).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.docsRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.updatePrompt).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "refreshes managed docs before inspecting setup without opening a panel: incomplete=%s",
    async (incomplete) => {
      const { openSetupPanel } = await import("../src/setup-panel.ts");
      const { openDashboardPanel } = await import("../src/dashboard-panel.ts");
      mocks.workspace.workspaceFolders = [{ uri: { fsPath: "project" } }];
      mocks.docsRefresh.mockResolvedValue({ complete: true, updated: true });
      mocks.inspect.mockResolvedValue({ incomplete });
      await activate({
        subscriptions: [],
        extensionPath: "extension-v2",
      } as unknown as ExtensionContext);
      await vi.waitFor(() => expect(mocks.inspect).toHaveBeenCalled());
      expect(mocks.docsRefresh).toHaveBeenCalledWith(
        "project",
        "extension-v2/dist/aidlc-mcp.mjs",
        "extension-v2/docs-skill",
      );
      expect(mocks.docsRefresh.mock.invocationCallOrder[0]).toBeLessThan(
        Number(mocks.inspect.mock.invocationCallOrder[0]),
      );
      expect(mocks.setup).not.toHaveBeenCalled();
      expect(openSetupPanel).not.toHaveBeenCalled();
      expect(openDashboardPanel).not.toHaveBeenCalled();
    },
  );
  it("stops startup after a pending docs refresh when the folder is removed", async () => {
    let finish = () => {};
    mocks.docsRefresh.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "project" } }];
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    mocks.workspace.workspaceFolders = undefined;
    mocks.folders.mock.calls[0]?.[0]();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(mocks.updatePrompt).not.toHaveBeenCalled();
    expect(mocks.setup).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "opens setup or dashboard only on the Open command: incomplete=%s",
    async (incomplete) => {
      const { openDashboardPanel } = await import("../src/dashboard-panel.ts");
      mocks.workspace.workspaceFolders = [{ uri: { fsPath: "project" } }];
      mocks.setup.mockResolvedValue(incomplete);
      const context = { subscriptions: [] } as unknown as ExtensionContext;
      await activate(context);
      expect(mocks.setup).not.toHaveBeenCalled();
      const open = mocks.register.mock.calls.find((call) => call[0] === "aidlc-guide.open")?.[1];
      await open();
      expect(mocks.setup).toHaveBeenCalledWith(context, "project", expect.any(Function));
      expect(openDashboardPanel).toHaveBeenCalledTimes(incomplete ? 0 : 1);
    },
  );
  it("opens setup explicitly from the Setup command", async () => {
    const { openSetupPanel } = await import("../src/setup-panel.ts");
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "project" } }];
    const context = { subscriptions: [] } as unknown as ExtensionContext;
    await activate(context);
    expect(openSetupPanel).not.toHaveBeenCalled();
    const setup = mocks.register.mock.calls.find((call) => call[0] === "aidlc-guide.setup")?.[1];
    setup();
    expect(openSetupPanel).toHaveBeenCalledWith(context, "project");
  });
  it("opens updates for the requested open folder and rejects unknown roots", async () => {
    const { openWorkflowsUpdatePanel } = await import("../src/workflows-update-panel.ts");
    mocks.workspace.workspaceFolders = [
      { uri: { fsPath: "primary" } },
      { uri: { fsPath: "dashboard-project" } },
    ];
    const context = { subscriptions: [] } as unknown as ExtensionContext;
    await activate(context);
    const update = mocks.register.mock.calls.find(
      (call) => call[0] === "aidlc-guide.updateWorkflows",
    )?.[1];
    update("dashboard-project");
    update();
    expect(openWorkflowsUpdatePanel).toHaveBeenNthCalledWith(1, context, "dashboard-project");
    expect(openWorkflowsUpdatePanel).toHaveBeenNthCalledWith(2, context, "primary");
    update("closed-project");
    expect(openWorkflowsUpdatePanel).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenCalled();
  });
  it("registers commands without opening setup when a folder is added", async () => {
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    expect(mocks.register).toHaveBeenCalledWith("aidlc-guide.setup", expect.any(Function));
    expect(mocks.setup).not.toHaveBeenCalled();
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "new-project" } }];
    mocks.folders.mock.calls[0]?.[0]();
    await vi.waitFor(() =>
      expect(mocks.inspect).toHaveBeenCalledWith(expect.anything(), "new-project"),
    );
    expect(mocks.setup).not.toHaveBeenCalled();
    expect(mocks.updatePrompt).not.toHaveBeenCalled();
  });
  it("only prompts for updates after completed setup", async () => {
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "ready" } }];
    mocks.inspect.mockResolvedValue({ incomplete: false });
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    await vi.waitFor(() =>
      expect(mocks.updatePrompt).toHaveBeenCalledWith(
        expect.anything(),
        "ready",
        expect.any(Function),
      ),
    );
  });
  it("does not start workspace readers in restricted mode", async () => {
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "untrusted" } }];
    mocks.workspace.isTrusted = false;
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.setup).not.toHaveBeenCalled();
    expect(mocks.inspect).not.toHaveBeenCalled();
  });
  it("does not open the workflows update panel in restricted mode", async () => {
    const { openWorkflowsUpdatePanel } = await import("../src/workflows-update-panel.ts");
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "untrusted" } }];
    mocks.workspace.isTrusted = false;
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    const update = mocks.register.mock.calls.find(
      (call) => call[0] === "aidlc-guide.updateWorkflows",
    )?.[1];
    update();
    expect(openWorkflowsUpdatePanel).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });
  it("opens workflows installation for the invoking dashboard's workspace", async () => {
    const { openWorkflowsInstallPanel } = await import("../src/setup-panel.ts");
    mocks.workspace.workspaceFolders = [
      { uri: { fsPath: "primary" } },
      { uri: { fsPath: "dashboard-project" } },
    ];
    const context = { subscriptions: [] } as unknown as ExtensionContext;
    await activate(context);
    const install = mocks.register.mock.calls.find(
      (call) => call[0] === "aidlc-guide.installWorkflows",
    )?.[1];
    install("dashboard-project");
    expect(openWorkflowsInstallPanel).toHaveBeenCalledWith(context, "dashboard-project");
    install();
    expect(openWorkflowsInstallPanel).toHaveBeenLastCalledWith(context, "primary");
  });
  it.each([undefined, "removed", { path: "project" }])(
    "refuses installation when the requested workspace is unavailable: %s",
    async (root) => {
      const { openWorkflowsInstallPanel } = await import("../src/setup-panel.ts");
      await activate({ subscriptions: [] } as unknown as ExtensionContext);
      const install = mocks.register.mock.calls.find(
        (call) => call[0] === "aidlc-guide.installWorkflows",
      )?.[1];
      install(root);
      expect(openWorkflowsInstallPanel).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenCalled();
    },
  );
  it("does not open workflows installation in restricted mode", async () => {
    const { openWorkflowsInstallPanel } = await import("../src/setup-panel.ts");
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "untrusted" } }];
    mocks.workspace.isTrusted = false;
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    const install = mocks.register.mock.calls.find(
      (call) => call[0] === "aidlc-guide.installWorkflows",
    )?.[1];
    install();
    expect(openWorkflowsInstallPanel).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });
  it("invalidates pending startup when the primary folder changes or is removed", async () => {
    let finishA: (value: { incomplete: boolean }) => void = () => {};
    mocks.inspect.mockReturnValueOnce(
      new Promise<{ incomplete: boolean }>((resolve) => {
        finishA = resolve;
      }),
    );
    mocks.inspect.mockResolvedValue({ incomplete: false });
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "a" } }];
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    await vi.waitFor(() => expect(mocks.inspect).toHaveBeenCalledTimes(1));
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "b" } }];
    mocks.folders.mock.calls[0]?.[0]();
    finishA({ incomplete: false });
    await vi.waitFor(() => expect(mocks.updatePrompt).toHaveBeenCalledTimes(1));
    expect(mocks.updatePrompt).toHaveBeenCalledWith(expect.anything(), "b", expect.any(Function));
    const isCurrentB = mocks.updatePrompt.mock.calls[0]?.[2];
    expect(isCurrentB()).toBe(true);
    mocks.workspace.workspaceFolders = undefined;
    mocks.folders.mock.calls[0]?.[0]();
    expect(isCurrentB()).toBe(false);
  });
});
