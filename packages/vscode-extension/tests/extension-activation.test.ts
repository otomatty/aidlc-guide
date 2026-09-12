import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  setup: vi.fn(),
  updatePrompt: vi.fn(),
  refresh: vi.fn(),
  status: vi.fn(),
  error: vi.fn(),
  folders: vi.fn(),
  trust: vi.fn(),
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
vi.mock("../src/guide-session.ts", () => ({ disposeAllSessions: vi.fn() }));
vi.mock("../src/mcp-register.ts", () => ({
  docsSkillPath: vi.fn(),
  mcpScriptPath: vi.fn(),
  registerMcp: vi.fn(),
}));
vi.mock("../src/setup-panel.ts", () => ({
  maybePromptSetup: mocks.setup,
  openSetupPanel: vi.fn(),
  openWorkflowsInstallPanel: vi.fn(),
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

import { activate } from "../src/extension.ts";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.workspaceFolders = undefined;
  mocks.workspace.isTrusted = true;
  mocks.setup.mockResolvedValue(true);
  mocks.refresh.mockReturnValue({ dispose: vi.fn() });
});
describe("first-run activation", () => {
  it("registers commands in an empty window and starts setup when a folder is added", async () => {
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    expect(mocks.register).toHaveBeenCalledWith("aidlc-guide.setup", expect.any(Function));
    expect(mocks.setup).not.toHaveBeenCalled();
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "new-project" } }];
    mocks.folders.mock.calls[0]?.[0]();
    await vi.waitFor(() =>
      expect(mocks.setup).toHaveBeenCalledWith(
        expect.anything(),
        "new-project",
        expect.any(Function),
      ),
    );
    expect(mocks.updatePrompt).not.toHaveBeenCalled();
  });
  it("only prompts for updates after completed setup", async () => {
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "ready" } }];
    mocks.setup.mockResolvedValue(false);
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
    expect(mocks.setup).toHaveBeenCalledWith(expect.anything(), "untrusted", expect.any(Function));
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
    let finishA: (value: boolean) => void = () => {};
    mocks.setup.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finishA = resolve;
      }),
    );
    mocks.setup.mockResolvedValue(false);
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "a" } }];
    await activate({ subscriptions: [] } as unknown as ExtensionContext);
    const isCurrentA = mocks.setup.mock.calls[0]?.[2];
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "b" } }];
    mocks.folders.mock.calls[0]?.[0]();
    finishA(false);
    await vi.waitFor(() => expect(mocks.updatePrompt).toHaveBeenCalledTimes(1));
    expect(mocks.updatePrompt).toHaveBeenCalledWith(expect.anything(), "b", expect.any(Function));
    expect(isCurrentA()).toBe(false);
    const isCurrentB = mocks.setup.mock.calls[1]?.[2];
    expect(isCurrentB()).toBe(true);
    mocks.workspace.workspaceFolders = undefined;
    mocks.folders.mock.calls[0]?.[0]();
    expect(isCurrentB()).toBe(false);
  });
});
