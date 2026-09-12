import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import type { NativeDoctorReport } from "../src/doctor-output.ts";
import type { SetupRunner } from "../src/native-setup.ts";
import type { SetupSnapshot } from "../src/setup-state.ts";
import type { WorkflowsInstallOptions, WorkflowsInstallResult } from "../src/workflows-install.ts";

const mocks = vi.hoisted(() => ({
  inspect: vi.fn(),
  refresh: vi.fn(),
  register: vi.fn(),
  install: vi.fn<(options: WorkflowsInstallOptions) => Promise<WorkflowsInstallResult>>(),
  onPath: vi.fn(),
  doctor: vi.fn(),
  nativeDoctor: vi.fn(),
  nativeProcess: vi.fn(),
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
  runNativeDoctor: mocks.nativeDoctor,
  runSetupProcess: mocks.nativeProcess,
  SETUP_RELEASE: "2.8.1",
  INSTALL_GUIDE_URL: "https://github.com/awslabs/aidlc-workflows",
}));
vi.mock("../src/workflows-install.ts", () => ({ installWorkflows: mocks.install }));
vi.mock("../src/doctor.ts", () => ({ runDoctor: mocks.doctor, onPath: mocks.onPath }));
vi.mock("../src/git-prerequisite.ts", async (original) => ({
  ...(await original<typeof import("../src/git-prerequisite.ts")>()),
  isGitRepository: mocks.git,
}));
vi.mock("../src/official-docs-root.ts", () => ({ resolveOfficialDocsRoot: () => "docs" }));
vi.mock("../src/dashboard-panel.ts", () => ({ openDashboardPanel: mocks.dashboard }));

import { maybePromptSetup, openSetupPanel, openWorkflowsInstallPanel } from "../src/setup-panel.ts";

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
const healthyReport: NativeDoctorReport = {
  version: "2.8.1",
  executedAt: "2026-09-11T00:00:00.000Z",
  outcome: "ok",
  summary: "診断が完了しました。問題はありません。",
  checks: [],
  counts: { passed: 1, warnings: 0, failed: 0 },
  rawOutput: "original doctor output",
  unparsedOutput: [],
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
function successfulInstall(options: WorkflowsInstallOptions): WorkflowsInstallResult {
  const harnesses = options.selected.map((id) => ({
    id,
    status: "configured" as const,
    message: `${id} の設定が完了しました。`,
    doctorOk: true,
    doctorReport: healthyReport,
  }));
  for (const entry of harnesses) options.onHarnessResult?.(entry);
  return {
    ok: true,
    target: "2.8.1",
    message: "選択したツールの準備が完了しました。",
    harnesses,
  };
}

function makePanel(): typeof panel {
  const callbacks: (() => void)[] = [];
  const created = {
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
      for (const callback of callbacks) callback();
    },
    onDidDispose: vi.fn((fn) => {
      callbacks.push(fn);
      return { dispose: vi.fn() };
    }),
  };
  cleanups.push(created.dispose);
  return created;
}

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
  mocks.install.mockReset().mockImplementation(async (options) => successfulInstall(options));
  mocks.nativeDoctor.mockResolvedValue(healthyReport);
  mocks.onPath.mockResolvedValue(true);
  mocks.register.mockResolvedValue({ ok: true });
  panel = makePanel();
  mocks.create.mockReturnValue(panel);
});

describe("setup startup and actions", () => {
  it("shows the installer's Git prerequisite failure and blocks Codex completion", async () => {
    mocks.git.mockResolvedValue(false);
    mocks.install.mockResolvedValueOnce({
      ok: false,
      target: null,
      reason: "git-required",
      message: "Codex を利用するには git init を実行してください。",
      harnesses: [],
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "install", harnesses: ["codex"] });
    expect(mocks.install).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ selected: ["codex"] }),
    );
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["codex"] });
    await receive({ type: "finish", harnesses: ["codex"] });
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
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    await openSetupPanel(context, "workspace");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("invalidates the installer and discards its result if the folder disappears without an event", async () => {
    let finish: () => void = () => {};
    mocks.install.mockImplementationOnce(async (options) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return successfulInstall(options);
    });
    await openSetupPanel(context, "workspace");
    const action = receive({ type: "install" });
    await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    mocks.workspace.workspaceFolders = [];
    expect(mocks.install.mock.calls[0]?.[0].isCurrent?.()).toBe(false);
    finish();
    await action;
    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "doctor-report" }),
    );
    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "status", text: "選択したツールの準備が完了しました。" }),
    );
  });
  it.each(["folder removal", "panel closure"])(
    "cancels the shared installer on %s and ignores late progress",
    async (reason) => {
      let finish: () => void = () => {};
      mocks.install.mockImplementationOnce(async (options) => {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return successfulInstall(options);
      });
      await openSetupPanel(context, "workspace");
      const action = receive({ type: "install" });
      await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
      const options = mocks.install.mock.calls[0]?.[0];
      if (reason === "folder removal") {
        mocks.workspace.workspaceFolders = [];
        mocks.folders.mock.calls[0]?.[0]();
      } else panel.dispose();
      expect(options?.signal?.aborted).toBe(true);
      expect(options?.isCurrent?.()).toBe(false);
      const messageCount = panel.webview.postMessage.mock.calls.length;
      finish();
      await action;
      expect(panel.webview.postMessage).toHaveBeenCalledTimes(messageCount);
    },
  );
  it("does not register docs if the folder disappears during the Bun check", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
    mocks.onPath.mockImplementationOnce(async () => {
      mocks.workspace.workspaceFolders = [];
      return true;
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "register-mcp" });
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("does not open a removed folder's dashboard after persisting completion", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
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
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
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
    "restores an available saved harness first and retains installed tools: %s",
    async (harness) => {
      mocks.inspect.mockResolvedValue({
        ...empty,
        configured: true,
        harnesses: ["cursor", "codex"],
        preference: { completed: true, docsSkipped: false, harness },
      });
      await openSetupPanel(context, "workspace");
      const expected = harness === "codex" ? "codex" : "cursor";
      const expectedSelection = harness === "codex" ? ["codex", "cursor"] : ["cursor", "codex"];
      for (const id of expectedSelection)
        expect(panel.webview.html).toContain(`name="harness" value="${id}" checked`);
      expect(panel.webview.html).not.toContain('name="harness" value="claude" checked');
      await receive({ type: "finish" });
      expect(savedPreference).toMatchObject({ harness: expected, harnesses: expectedSelection });
    },
  );
  it("passes panel invalidation to a delayed docs registration", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
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
    mocks.install.mockResolvedValueOnce({
      ok: false,
      target: "2.8.2",
      reason: "version-conflict",
      message: "aidlc use 2.8.2 を実行してください。",
      harnesses: [],
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "install" });
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
    await receive({ type: "install", harnesses: ["cursor"] });
    expect(mocks.install).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "status", error: true }),
    );
  });
  it("forwards selected harnesses to the shared service and restores results after rerender", async () => {
    mocks.install.mockImplementationOnce(async (options) => {
      options.log("選択したツールの設定ログ");
      return successfulInstall(options);
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "install", harnesses: ["claude", "cursor"] });
    expect(mocks.install).toHaveBeenCalledExactlyOnceWith({
      workspaceRoot: "workspace",
      selected: ["claude", "cursor"],
      log: expect.any(Function),
      signal: expect.any(AbortSignal),
      isCurrent: expect.any(Function),
      onHarnessResult: expect.any(Function),
    });
    await receive({ type: "ready" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "restore",
        text: "選択したツールの準備が完了しました。",
        log: "選択したツールの設定ログ\n",
        doctorReport: healthyReport,
        installResults: [
          expect.objectContaining({ id: "claude", status: "configured" }),
          expect.objectContaining({ id: "cursor", status: "configured" }),
        ],
      }),
    );
    expect(mocks.nativeDoctor).not.toHaveBeenCalled();
  });
  it("prevents duplicate installation and releases controls after a failure", async () => {
    let reject: (error: Error) => void = () => {};
    mocks.install.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    await openSetupPanel(context, "workspace");
    const first = receive({ type: "install", harnesses: ["cursor"] });
    await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    await receive({ type: "install", harnesses: ["cursor"] });
    reject(new Error("download failed"));
    await first;
    expect(mocks.install).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: "busy", value: false });
    await receive({ type: "install" });
    expect(mocks.install).toHaveBeenCalledTimes(2);
  });
  it("requires actual project setup before completing or registering docs", async () => {
    await openSetupPanel(context, "workspace");
    await receive({ type: "finish" });
    await receive({ type: "register-mcp" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("allows completion without an Intent or optional docs and remembers the choice", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
    await openSetupPanel(context, "workspace");
    await receive({ type: "finish", harnesses: ["cursor"] });
    expect(mocks.update).toHaveBeenCalledWith("aidlc-guide.setup.v2:workspace", {
      completed: true,
      docsSkipped: true,
      harness: "cursor",
      harnesses: ["cursor"],
    });
    expect(mocks.dashboard).toHaveBeenCalledWith(context, "workspace");
  });
  it("keeps the completed project usable when Bun is missing for optional docs", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
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

  it("restores an available saved selection and writes both preference formats", async () => {
    mocks.inspect.mockResolvedValue({
      ...empty,
      configured: true,
      harnesses: ["cursor", "claude", "codex"],
      preference: {
        completed: true,
        docsSkipped: true,
        harness: "codex",
        harnesses: ["claude", "cursor", "opencode", "invalid"],
      },
    });
    await openSetupPanel(context, "workspace");
    for (const id of ["claude", "cursor", "codex"])
      expect(panel.webview.html).toContain(`name="harness" value="${id}" checked`);
    expect(panel.webview.html).not.toContain('name="harness" value="opencode" checked');
    await receive({ type: "finish" });
    expect(savedPreference).toEqual({
      completed: true,
      docsSkipped: true,
      harness: "claude",
      harnesses: ["claude", "cursor", "codex"],
    });
  });

  it("initially selects every detected harness when no preference is available", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, harnesses: ["claude", "cursor"] });
    await openSetupPanel(context, "workspace");
    await receive({ type: "install" });
    expect(mocks.install).toHaveBeenCalledWith(
      expect.objectContaining({ selected: ["claude", "cursor"] }),
    );
  });

  it("keeps an edited selection for installation and removes duplicate harnesses", async () => {
    await openSetupPanel(context, "workspace");
    await receive({ type: "select-harnesses", harnesses: ["claude", "cursor", "claude"] });
    expect(mocks.install).not.toHaveBeenCalled();
    await receive({ type: "install" });
    expect(mocks.install).toHaveBeenCalledWith(
      expect.objectContaining({ selected: ["claude", "cursor"] }),
    );
  });

  it.each([
    { harnesses: "cursor" },
    { harnesses: null },
    { harnesses: ["cursor", "unknown"] },
    { harnesses: ["cursor", 1] },
  ])(
    "refuses a malformed harness selection before calling the installer: %j",
    async ({ harnesses }) => {
      await openSetupPanel(context, "workspace");
      await receive({ type: "install", harnesses });
      expect(mocks.install).not.toHaveBeenCalled();
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "status",
          error: true,
          text: expect.stringContaining("選択"),
        }),
      );
    },
  );

  it.each([{ harnesses: [] }, { harnesses: ["cursor", "claude"] }])(
    "does not finish before every selected harness is configured: %j",
    async ({ harnesses }) => {
      mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
      await openSetupPanel(context, "workspace");
      await receive({ type: "finish", harnesses });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.dashboard).not.toHaveBeenCalled();
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "status", error: true }),
      );
    },
  );

  it("retains partial results and keeps completed tools alongside failed tools for a retry", async () => {
    const partial: WorkflowsInstallResult = {
      ok: false,
      target: "2.8.1",
      reason: "configure-failed",
      message: "一部のツールを設定できませんでした。",
      harnesses: [
        {
          id: "cursor",
          status: "configured",
          message: "Cursor の設定が完了しました。",
          doctorOk: true,
        },
        { id: "claude", status: "failed", message: "Claude Code の設定に失敗しました。" },
      ],
    };
    mocks.install.mockImplementationOnce(async (options) => {
      for (const entry of partial.harnesses) options.onHarnessResult?.(entry);
      mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
      return partial;
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "install", harnesses: ["cursor", "claude"] });
    await receive({ type: "ready" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "restore", error: true, installResults: partial.harnesses }),
    );
    expect(panel.webview.html).toContain('name="harness" value="claude" checked');
    expect(panel.webview.html).toContain('name="harness" value="cursor" checked disabled');
    await receive({ type: "install" });
    expect(mocks.install).toHaveBeenLastCalledWith(
      expect.objectContaining({ selected: ["claude", "cursor"] }),
    );
    await receive({ type: "ready" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "restore",
        error: false,
        installResults: [
          expect.objectContaining({ id: "claude", status: "configured" }),
          expect.objectContaining({ id: "cursor", status: "configured" }),
        ],
      }),
    );
  });

  it("discards installer progress when workspace trust is revoked", async () => {
    let finish: () => void = () => {};
    mocks.install.mockImplementationOnce(async (options) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return successfulInstall(options);
    });
    await openSetupPanel(context, "workspace");
    const action = receive({ type: "install" });
    await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    mocks.workspace.isTrusted = false;
    expect(mocks.install.mock.calls[0]?.[0].isCurrent?.()).toBe(false);
    finish();
    await action;
    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "doctor-report" }),
    );
    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "status", text: "選択したツールの準備が完了しました。" }),
    );
  });
});

describe("installation from settings", () => {
  it("offers the installer on a configured project without onboarding completion or docs actions", async () => {
    mocks.inspect.mockResolvedValue({ ...empty, configured: true, harnesses: ["cursor"] });
    await openWorkflowsInstallPanel(context, "workspace");
    expect(mocks.create).toHaveBeenCalledWith(
      "aidlcGuide.workflowsInstall",
      "aidlc-workflows インストール",
      1,
      expect.anything(),
    );
    expect(panel.webview.html).not.toContain('id="finish"');
    expect(panel.webview.html).not.toContain('id="register-mcp"');
    await receive({ type: "finish" });
    await receive({ type: "register-mcp" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.dashboard).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    await receive({ type: "install", harnesses: ["claude", "cursor"] });
    expect(mocks.install).toHaveBeenCalledWith(
      expect.objectContaining({ selected: ["claude", "cursor"] }),
    );
    await openWorkflowsInstallPanel(context, "workspace");
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(panel.reveal).toHaveBeenCalled();
  });

  it("shares the folder lock across setup and settings until a cancelled operation settles", async () => {
    let finish: () => void = () => {};
    mocks.install.mockImplementationOnce(async (options) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return successfulInstall(options);
    });
    await openSetupPanel(context, "workspace");
    const setupReceive = receive;
    const setupPanel = panel;
    panel = makePanel();
    mocks.create.mockReturnValue(panel);
    await openWorkflowsInstallPanel(context, "workspace");
    const settingsReceive = receive;
    const first = setupReceive({ type: "install", harnesses: ["cursor"] });
    await vi.waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    setupPanel.dispose();
    await settingsReceive({ type: "install", harnesses: ["claude"] });
    expect(mocks.install).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "status",
        error: true,
        text: expect.stringContaining("実行中"),
      }),
    );
    finish();
    await first;
    await settingsReceive({ type: "install" });
    expect(mocks.install).toHaveBeenCalledTimes(2);
    expect(mocks.install).toHaveBeenLastCalledWith(
      expect.objectContaining({ selected: ["claude"] }),
    );
  });
});

describe("native diagnosis in setup", () => {
  const installed = { executable: "pinned/aidlc", version: "2.8.1", binDir: "bin" };
  beforeEach(() => {
    mocks.inspect.mockResolvedValue({
      ...empty,
      native: installed,
      configured: true,
      version: "2.8.1",
    });
  });

  it("diagnoses every detected tool and retains a failure after the first tool passes", async () => {
    mocks.inspect.mockResolvedValue({
      ...empty,
      native: installed,
      harnesses: ["claude", "cursor"],
    });
    const broken: NativeDoctorReport = {
      ...healthyReport,
      outcome: "failed",
      summary: "Cursor の設定に問題があります。",
      counts: { passed: 0, warnings: 0, failed: 1 },
      rawOutput: "Cursor hook file missing",
      checks: [
        {
          section: "project",
          status: "fail",
          label: "フックがありません。",
          originalLabel: "Cursor hook file missing",
          translated: true,
        },
      ],
    };
    mocks.nativeDoctor.mockResolvedValueOnce(healthyReport).mockResolvedValueOnce(broken);
    await openSetupPanel(context, "workspace");
    await receive({ type: "run-doctor", harnesses: ["claude"] });
    expect(mocks.nativeDoctor).toHaveBeenCalledTimes(2);
    for (const [index, harnessDir] of [".claude", ".cursor"].entries()) {
      const [runtime, root, runner, options] = mocks.nativeDoctor.mock.calls[index] ?? [];
      expect(runtime).toEqual(installed);
      expect(root).toBe("workspace");
      expect(options.isCurrent()).toBe(true);
      await (runner as SetupRunner)("aidlc", ["doctor"], root, { NO_COLOR: "1" }, options.signal, {
        timeoutMs: 120000,
      });
      expect(mocks.nativeProcess).toHaveBeenLastCalledWith(
        "aidlc",
        ["doctor"],
        "workspace",
        { NO_COLOR: "1", AIDLC_HARNESS_DIR: harnessDir },
        options.signal,
        { timeoutMs: 120000 },
      );
    }
    const reports = [
      { id: "claude", report: healthyReport },
      { id: "cursor", report: broken },
    ];
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: "doctor-reports", reports });
    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "doctor-report" }),
    );
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "status",
        error: true,
        text: expect.stringContaining("Cursor"),
      }),
    );
    await receive({ type: "ready" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "restore", doctorReport: null, doctorReports: reports }),
    );
  });

  it.each(["close", "remove", "untrust"])(
    "discards all grouped results and earlier cached results on %s",
    async (event) => {
      mocks.inspect.mockResolvedValue({
        ...empty,
        native: installed,
        harnesses: ["claude", "cursor"],
      });
      await openSetupPanel(context, "workspace");
      await receive({ type: "run-doctor" });
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "doctor-reports" }),
      );
      panel.webview.postMessage.mockClear();
      let finish: (report: NativeDoctorReport) => void = () => {};
      mocks.nativeDoctor.mockResolvedValueOnce(healthyReport).mockReturnValueOnce(
        new Promise<NativeDoctorReport>((resolve) => {
          finish = resolve;
        }),
      );
      const action = receive({ type: "run-doctor" });
      await vi.waitFor(() => expect(mocks.nativeDoctor).toHaveBeenCalledTimes(4));
      await receive({ type: "ready" });
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "restore", doctorReport: null, doctorReports: [] }),
      );
      expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: "doctor-running" });
      if (event === "close") panel.dispose();
      else if (event === "remove") {
        mocks.workspace.workspaceFolders = [];
        mocks.folders.mock.calls[0]?.[0]();
      } else mocks.workspace.isTrusted = false;
      const options = mocks.nativeDoctor.mock.calls[3]?.[3];
      expect(options.isCurrent()).toBe(false);
      if (event !== "untrust") expect(options.signal.aborted).toBe(true);
      finish(healthyReport);
      await action;
      expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "doctor-reports" }),
      );
      expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "doctor-report" }),
      );
      if (event === "untrust") {
        await receive({ type: "ready" });
        expect(panel.webview.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: "restore", doctorReport: null, doctorReports: [] }),
        );
      }
    },
  );

  it.each(["ok", "warning", "failed", "unavailable"] as const)(
    "displays and restores a %s report from the project runtime",
    async (outcome) => {
      const report = { ...healthyReport, outcome, summary: `診断結果: ${outcome}` };
      mocks.nativeDoctor.mockResolvedValueOnce(report);
      await openSetupPanel(context, "workspace");
      await receive({ type: "run-doctor" });
      expect(mocks.nativeDoctor).toHaveBeenCalledExactlyOnceWith(
        installed,
        "workspace",
        undefined,
        {
          signal: expect.any(AbortSignal),
          isCurrent: expect.any(Function),
        },
      );
      expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: "doctor-report", report });
      expect(panel.webview.postMessage).toHaveBeenCalledWith({
        type: "status",
        text: report.summary,
        error: outcome === "failed" || outcome === "unavailable",
      });
      await receive({ type: "ready" });
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "restore", doctorReport: report }),
      );
      expect(mocks.install).not.toHaveBeenCalled();
      expect(mocks.doctor).not.toHaveBeenCalled();
    },
  );

  it("explains a missing runtime without installing one or claiming a diagnosis ran", async () => {
    mocks.inspect.mockResolvedValue({ ...empty });
    await openSetupPanel(context, "workspace");
    await receive({ type: "run-doctor" });
    expect(mocks.nativeDoctor).not.toHaveBeenCalled();
    expect(mocks.install).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: "doctor-report",
      report: expect.objectContaining({
        outcome: "unavailable",
        counts: null,
        summary: expect.stringContaining("本体が見つかりません"),
      }),
    });
  });

  it("blocks diagnosis in an untrusted workspace", async () => {
    mocks.workspace.isTrusted = false;
    await openSetupPanel(context, "workspace");
    await receive({ type: "run-doctor" });
    expect(mocks.nativeDoctor).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "status",
        error: true,
        text: expect.stringContaining("信頼"),
      }),
    );
  });

  it("keeps the simple recheck separate from native diagnosis", async () => {
    mocks.doctor.mockResolvedValue({
      checks: [{ label: "確認項目", detail: "詳細", ok: true }],
      ready: true,
    });
    await openSetupPanel(context, "workspace");
    await receive({ type: "recheck" });
    expect(mocks.doctor).toHaveBeenCalledExactlyOnceWith("workspace", "docs");
    expect(mocks.nativeDoctor).not.toHaveBeenCalled();
  });

  it("prevents double execution and restores progress while a diagnosis runs", async () => {
    let finish: (report: NativeDoctorReport) => void = () => {};
    mocks.nativeDoctor.mockReturnValueOnce(
      new Promise<NativeDoctorReport>((resolve) => {
        finish = resolve;
      }),
    );
    await openSetupPanel(context, "workspace");
    const first = receive({ type: "run-doctor" });
    await vi.waitFor(() => expect(mocks.nativeDoctor).toHaveBeenCalledTimes(1));
    await receive({ type: "run-doctor" });
    await receive({ type: "ready" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: "doctor-running" });
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: "busy", value: true });
    finish(healthyReport);
    await first;
    expect(mocks.nativeDoctor).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: "busy", value: false });
  });

  it.each(["close", "remove", "untrust"])("discards a pending result on %s", async (event) => {
    let finish: (report: NativeDoctorReport) => void = () => {};
    mocks.nativeDoctor.mockReturnValueOnce(
      new Promise<NativeDoctorReport>((resolve) => {
        finish = resolve;
      }),
    );
    await openSetupPanel(context, "workspace");
    const action = receive({ type: "run-doctor" });
    await vi.waitFor(() => expect(mocks.nativeDoctor).toHaveBeenCalledTimes(1));
    if (event === "close") panel.dispose();
    else if (event === "remove") {
      mocks.workspace.workspaceFolders = [];
      mocks.folders.mock.calls[0]?.[0]();
    } else mocks.workspace.isTrusted = false;
    const options = mocks.nativeDoctor.mock.calls[0]?.[3];
    expect(options.isCurrent()).toBe(false);
    if (event !== "untrust") expect(options.signal.aborted).toBe(true);
    finish(healthyReport);
    await action;
    expect(panel.webview.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "doctor-report" }),
    );
  });

  it("shows a Japanese execution error after a rejected run and allows retry", async () => {
    mocks.nativeDoctor.mockRejectedValueOnce(new Error("unexpected spawn error"));
    await openSetupPanel(context, "workspace");
    await receive({ type: "run-doctor" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: "doctor-report",
      report: expect.objectContaining({
        outcome: "unavailable",
        summary: expect.stringContaining("診断を実行できません"),
        rawOutput: "unexpected spawn error",
      }),
    });
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: "busy", value: false });
    await receive({ type: "run-doctor" });
    expect(mocks.nativeDoctor).toHaveBeenCalledTimes(2);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: "doctor-report",
      report: healthyReport,
    });
  });
});
