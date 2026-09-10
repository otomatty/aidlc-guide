import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import type { SetupSnapshot } from "../src/setup-state.ts";

const mocks = vi.hoisted(() => ({
  inspect: vi.fn(),
  refresh: vi.fn(),
  register: vi.fn(),
  install: vi.fn(),
  native: vi.fn(),
  configure: vi.fn(),
  onPath: vi.fn(),
  doctor: vi.fn(),
  show: vi.fn(),
  error: vi.fn(),
  update: vi.fn(),
  dashboard: vi.fn(),
  create: vi.fn(),
  external: vi.fn(),
  trust: vi.fn(() => ({ dispose: vi.fn() })),
  folders: vi.fn((_listener: () => void) => ({ dispose: vi.fn() })),
  workspace: { isTrusted: true, workspaceFolders: [{ uri: { fsPath: "workspace" } }] },
}));
vi.mock("vscode", () => ({
  ViewColumn: { One: 1 },
  Uri: { parse: (url: string) => url },
  env: { appName: "Cursor", openExternal: mocks.external },
  window: {
    createWebviewPanel: mocks.create,
    showInformationMessage: mocks.show,
    showErrorMessage: mocks.error,
  },
  workspace: Object.assign(mocks.workspace, {
    onDidGrantWorkspaceTrust: mocks.trust,
    onDidChangeWorkspaceFolders: mocks.folders,
  }),
}));
vi.mock("../src/setup-state.ts", async (original) => ({
  ...(await original<typeof import("../src/setup-state.ts")>()),
  inspectSetup: mocks.inspect,
}));
vi.mock("../src/mcp-register.ts", () => ({
  refreshDocsRegistration: mocks.refresh,
  registerMcp: mocks.register,
  mcpScriptPath: () => "script",
  docsSkillPath: () => "skill",
}));
vi.mock("../src/native-setup.ts", () => ({
  installNative: mocks.install,
  configureNative: mocks.configure,
  readNativeInstall: mocks.native,
  SETUP_RELEASE: "2.8.1",
  INSTALL_GUIDE_URL: "https://github.com/awslabs/aidlc-workflows",
}));
vi.mock("../src/doctor.ts", () => ({ runDoctor: mocks.doctor, onPath: mocks.onPath }));
vi.mock("../src/official-docs-root.ts", () => ({ resolveOfficialDocsRoot: () => "docs" }));
vi.mock("../src/dashboard-panel.ts", () => ({ openDashboardPanel: mocks.dashboard }));

import { maybePromptSetup, openSetupPanel } from "../src/setup-panel.ts";

const empty: SetupSnapshot = {
  root: "workspace",
  configured: false,
  projectPresent: false,
  native: null,
  version: null,
  harnesses: [],
  docsReady: false,
  preference: undefined,
};
const context = {
  extensionPath: "extension",
  subscriptions: [],
  workspaceState: { update: mocks.update },
} as unknown as ExtensionContext;
let receive: (message: unknown) => Promise<void>;
let panel: {
  webview: {
    html: string;
    postMessage: ReturnType<typeof vi.fn>;
    onDidReceiveMessage: ReturnType<typeof vi.fn>;
  };
  reveal: ReturnType<typeof vi.fn>;
  dispose: () => void;
  onDidDispose: ReturnType<typeof vi.fn>;
};
let cleanups: (() => void)[] = [];
beforeEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  vi.clearAllMocks();
  mocks.workspace.isTrusted = true;
  mocks.workspace.workspaceFolders = [{ uri: { fsPath: "workspace" } }];
  mocks.inspect.mockResolvedValue({ ...empty });
  mocks.refresh.mockResolvedValue({ complete: false, updated: false });
  mocks.native.mockReturnValue({ executable: "aidlc", version: "2.8.1", binDir: "bin" });
  mocks.configure.mockResolvedValue({ doctorOk: true, details: "ok" });
  mocks.onPath.mockResolvedValue(true);
  mocks.register.mockResolvedValue({ ok: true });
  panel = {
    webview: {
      html: "",
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((fn) => {
        receive = fn;
        return { dispose: vi.fn() };
      }),
    },
    reveal: vi.fn(),
    dispose: () => {
      for (const cleanup of cleanups) cleanup();
    },
    onDidDispose: vi.fn((fn) => {
      cleanups.push(fn);
      return { dispose: vi.fn() };
    }),
  };
  mocks.create.mockReturnValue(panel);
});

describe("setup startup and actions", () => {
  it("disposes the old setup panel and rejects actions after its folder is removed", async () => {
    await openSetupPanel(context, "workspace");
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "replacement" } }];
    mocks.folders.mock.calls[0]?.[0]();
    for (const type of ["install", "register-mcp", "finish"]) await receive({ type });
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    await openSetupPanel(context, "workspace");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("does not configure a removed folder after a pending install finishes", async () => {
    let finish: () => void = () => {};
    mocks.native.mockReturnValue(null);
    mocks.install.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await openSetupPanel(context, "workspace");
    const action = receive({ type: "install" });
    await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    mocks.workspace.workspaceFolders = [];
    finish();
    await action;
    expect(mocks.configure).not.toHaveBeenCalled();
  });
  it("does not register docs if the folder disappears during the Bun check", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true });
    mocks.onPath.mockImplementationOnce(async () => {
      mocks.workspace.workspaceFolders = [];
      return true;
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "register-mcp" });
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("does not open a removed folder's dashboard after persisting completion", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true });
    mocks.update.mockImplementationOnce(async () => {
      mocks.workspace.workspaceFolders = [];
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "finish" });
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });
  it.each(["refresh", "inspect"] as const)(
    "does not open stale setup after a delayed %s",
    async (phase) => {
      let current = true;
      let finish: (value: unknown) => void = () => {};
      mocks[phase].mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const pending = maybePromptSetup(context, "workspace", () => current);
      await vi.waitFor(() => expect(mocks[phase]).toHaveBeenCalled());
      current = false;
      finish(phase === "refresh" ? { updated: true } : empty);
      expect(await pending).toBe(false);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.show).not.toHaveBeenCalled();
    },
  );
  it("reports version remediation rather than success for an incompatible existing project", async () => {
    mocks.inspect.mockResolvedValue({
      ...empty,
      projectPresent: true,
      version: "2.8.2",
      runtimeIssue: "aidlc use 2.8.2 を実行してください。",
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "install" });
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "status",
        error: true,
        text: expect.stringContaining("aidlc use 2.8.2"),
      }),
    );
    await receive({ type: "finish" });
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });
  it("clears an earlier skip when docs are explicitly enabled", async () => {
    mocks.inspect.mockResolvedValue({
      ...empty,
      configured: true,
      preference: { completed: true, docsSkipped: true, harness: "cursor" },
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "register-mcp" });
    expect(mocks.update).toHaveBeenCalledWith("aidlc-guide.setup.v2:workspace", {
      completed: true,
      docsSkipped: false,
      harness: "cursor",
    });
  });
  it("opens setup automatically without a notification asking permission", async () => {
    expect(await maybePromptSetup(context, "workspace")).toBe(true);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.show).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(panel.webview.html).toContain("インストールして設定");
  });
  it("does not open for a completed workspace, including skipped optional docs", async () => {
    mocks.inspect.mockResolvedValue({
      ...empty,
      configured: true,
      preference: { completed: true, docsSkipped: true },
    });
    expect(await maybePromptSetup(context, "workspace")).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("shares one panel between startup and the Setup command", async () => {
    await Promise.all([
      maybePromptSetup(context, "workspace"),
      openSetupPanel(context, "workspace"),
    ]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(panel.reveal).toHaveBeenCalled();
  });
  it("closing unfinished setup leaves it eligible for the next startup", async () => {
    await maybePromptSetup(context, "workspace");
    panel.dispose();
    await maybePromptSetup(context, "workspace");
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("ignores unknown messages and blocks writes in an untrusted workspace", async () => {
    mocks.workspace.isTrusted = false;
    await maybePromptSetup(context, "workspace");
    await receive(null);
    await receive({ type: "unknown" });
    await receive({ type: "install", harness: "cursor" });
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "status", error: true }),
    );
  });
  it("configures the selected harness with an existing runtime and retains progress after rerender", async () => {
    await openSetupPanel(context, "workspace");
    await receive({ type: "install", harness: "copilot" });
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.configure).toHaveBeenCalledWith(
      expect.anything(),
      "workspace",
      "copilot",
      expect.any(Function),
    );
    await receive({ type: "ready" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "restore", text: "AI-DLC の設定が完了しました。" }),
    );
  });
  it("prevents duplicate installation and releases controls after a failure", async () => {
    let reject: (error: Error) => void = () => {};
    mocks.native.mockReturnValue(null);
    mocks.install.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    await openSetupPanel(context, "workspace");
    const first = receive({ type: "install", harness: "cursor" });
    await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    await receive({ type: "install", harness: "cursor" });
    reject(new Error("download failed"));
    await first;
    expect(mocks.install).toHaveBeenCalledTimes(1);
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: "busy", value: false });
  });
  it("requires actual project setup before completing or registering docs", async () => {
    await openSetupPanel(context, "workspace");
    await receive({ type: "finish" });
    await receive({ type: "register-mcp" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("allows completion without an Intent or optional docs and remembers the choice", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true });
    await openSetupPanel(context, "workspace");
    await receive({ type: "finish", harness: "cursor" });
    expect(mocks.update).toHaveBeenCalledWith("aidlc-guide.setup.v2:workspace", {
      completed: true,
      docsSkipped: true,
      harness: "cursor",
    });
    expect(mocks.dashboard).toHaveBeenCalledWith(context, "workspace");
  });
  it("keeps the completed project usable when Bun is missing for optional docs", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true });
    mocks.onPath.mockResolvedValue(false);
    await openSetupPanel(context, "workspace");
    await receive({ type: "register-mcp" });
    expect(mocks.register).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "status",
        text: expect.stringContaining("Bun が必要"),
        error: true,
      }),
    );
  });
});
