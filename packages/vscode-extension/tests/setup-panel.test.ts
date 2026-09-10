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
  get: vi.fn(),
  git: vi.fn(),
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
vi.mock("../src/git-prerequisite.ts", async (original) => ({
  ...(await original<typeof import("../src/git-prerequisite.ts")>()),
  isGitRepository: mocks.git,
}));
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
  workspaceState: { update: mocks.update, get: mocks.get },
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
let savedPreference: unknown;
beforeEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  vi.clearAllMocks();
  savedPreference = undefined;
  mocks.get.mockImplementation(() => savedPreference);
  mocks.update.mockImplementation(async (_key: string, value: unknown) => {
    savedPreference = value;
  });
  mocks.workspace.isTrusted = true;
  mocks.git.mockResolvedValue(true);
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
  it("blocks Codex installation and completion until Git is initialized", async () => {
    mocks.git.mockResolvedValue(false);
    await openSetupPanel(context, "workspace");
    await receive({ type: "install", harness: "codex" });
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.configure).not.toHaveBeenCalled();
    mocks.inspect.mockResolvedValue({ ...empty, configured: true });
    await receive({ type: "finish", harness: "codex" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "status",
        error: true,
        text: expect.stringContaining("git init"),
      }),
    );
  });
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
  it.each(["folder removal", "panel closure"])(
    "cancels a delayed native preview on %s and never applies its plan",
    async (reason) => {
      const { configureNative } =
        await vi.importActual<typeof import("../src/native-setup.ts")>("../src/native-setup.ts");
      let finish: () => void = () => {};
      const runner = vi.fn(async () => {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return {
          code: 0,
          stdout: JSON.stringify({ data: { planToken: "cancelled-plan" } }),
          stderr: "",
        };
      });
      mocks.configure.mockImplementationOnce((install, root, harness, log, _runner, options) =>
        configureNative(install, root, harness, log, runner, options),
      );
      await openSetupPanel(context, "workspace");
      const action = receive({ type: "install" });
      await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(1));
      const options = mocks.configure.mock.calls[0]?.[5];
      if (reason === "folder removal") {
        mocks.workspace.workspaceFolders = [];
        mocks.folders.mock.calls[0]?.[0]();
      } else panel.dispose();
      expect(options.signal.aborted).toBe(true);
      expect(options.isCurrent()).toBe(false);
      finish();
      await action;
      expect(runner).toHaveBeenCalledTimes(1);
      expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "status", text: "AI-DLC の設定が完了しました。" }),
      );
    },
  );
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
    mocks.update.mockImplementationOnce(async (_key: string, value: unknown) => {
      savedPreference = value;
      mocks.workspace.workspaceFolders = [];
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "finish" });
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(savedPreference).toBeUndefined();
    expect(mocks.update).toHaveBeenLastCalledWith("aidlc-guide.setup.v2:workspace", undefined);
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "workspace" } }];
    panel.dispose();
    expect(await maybePromptSetup(context, "workspace")).toBe(true);
  });
  it("restores a prior preference when a delayed completion is cancelled", async () => {
    const previous = { completed: false, docsSkipped: false, harness: "codex" };
    savedPreference = previous;
    mocks.inspect.mockResolvedValue({
      ...empty,
      configured: true,
      harnesses: ["cursor", "codex"],
      preference: previous,
    });
    let finish: () => void = () => {};
    mocks.update.mockImplementationOnce(async (_key: string, value: unknown) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      savedPreference = value;
    });
    await openSetupPanel(context, "workspace");
    const action = receive({ type: "finish" });
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    mocks.workspace.workspaceFolders = [];
    finish();
    await action;
    expect(savedPreference).toEqual(previous);
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });
  it("preserves a newer preference written by another command during cancellation", async () => {
    const newer = { completed: false, docsSkipped: true, harness: "claude" };
    mocks.inspect.mockResolvedValue({ ...empty, configured: true });
    mocks.update.mockImplementationOnce(async () => {
      savedPreference = newer;
      mocks.workspace.workspaceFolders = [];
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "finish" });
    expect(savedPreference).toEqual(newer);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it.each(["codex", "invalid", "claude"])(
    "restores only an available saved harness: %s",
    async (harness) => {
      mocks.inspect.mockResolvedValue({
        ...empty,
        configured: true,
        harnesses: ["cursor", "codex"],
        preference: { completed: true, docsSkipped: false, harness },
      });
      await openSetupPanel(context, "workspace");
      const expected = harness === "codex" ? "codex" : "cursor";
      expect(panel.webview.html).toContain(`<option value="${expected}" selected>`);
      expect(panel.webview.html).toContain(expected === "codex" ? "$aidlc" : "/aidlc");
      await receive({ type: "finish" });
      expect(savedPreference).toMatchObject({ harness: expected });
    },
  );
  it("passes panel invalidation to a delayed docs registration", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true });
    let finish: () => void = () => {};
    mocks.register.mockImplementationOnce(async (_root, _script, _skill, isCurrent) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return isCurrent() ? { ok: true } : { ok: false, reason: "registration-cancelled" };
    });
    await openSetupPanel(context, "workspace");
    const action = receive({ type: "register-mcp" });
    await vi.waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    mocks.workspace.workspaceFolders = [];
    finish();
    await action;
    expect(mocks.update).not.toHaveBeenCalled();
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
      undefined,
      { signal: expect.any(AbortSignal), isCurrent: expect.any(Function) },
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
