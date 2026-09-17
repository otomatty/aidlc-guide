import { WORKFLOWS_TARGET_VERSION, type WorkflowsManagementState } from "@aidlc-guide/shared-types";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { NEWER_WORKFLOWS_VERSION } from "./workflows-version-fixture.ts";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  inspect: vi.fn(),
  update: vi.fn(),
  inspectCli: vi.fn(),
  updateCli: vi.fn(),
  doctor: vi.fn(),
  commands: vi.fn(),
  repair: vi.fn(),
  probe: vi.fn(),
  clipboard: vi.fn(),
  workspace: {
    isTrusted: true,
    workspaceFolders: [{ uri: { fsPath: "project" } }],
    onDidChangeWorkspaceFolders: vi.fn(),
  },
}));
vi.mock("vscode", () => ({
  commands: { executeCommand: mocks.commands },
  env: { clipboard: { writeText: mocks.clipboard } },
  Uri: {},
  ViewColumn: { One: 1 },
  window: { createWebviewPanel: mocks.create, showErrorMessage: vi.fn() },
  workspace: mocks.workspace,
}));
vi.mock("../src/workflows-management.ts", () => ({ inspectWorkflowsManagement: mocks.inspect }));
vi.mock("../src/workflows-update.ts", () => ({ updateInstalledWorkflows: mocks.update }));
vi.mock("../src/cli-management.ts", () => ({
  inspectCliManagement: mocks.inspectCli,
  updateMachineCli: mocks.updateCli,
}));
vi.mock("../src/cli-environment.ts", () => ({ configureCliEnvironment: vi.fn() }));
vi.mock("../src/workflows-diagnose.ts", () => ({ diagnoseInstalledWorkflows: mocks.doctor }));
vi.mock("../src/workflows-repair.ts", () => ({
  repairWorkflows: mocks.repair,
  probeRepairTools: mocks.probe,
  REPAIR_TOOLS: ["claude", "cursor", "copilot"],
}));

import type { CliManagementState } from "../src/cli-management.ts";
import { applyNativeWorkflowsUpdate } from "../src/workflows-native-update.ts";
import {
  cliUpdateMessage,
  openWorkflowsUpdatePanel,
  workflowsUpdateHtml,
  workflowsUpdateMessage,
} from "../src/workflows-update-panel.ts";

const cli: CliManagementState = {
  machineVersion: WORKFLOWS_TARGET_VERSION,
  projectPin: "2.8.0",
  projectVersion: "2.8.0",
  effectiveVersion: "2.8.0",
  target: WORKFLOWS_TARGET_VERSION,
  targetInstalled: true,
  launcherReady: true,
  setupReady: true,
  canPrepare: false,
  canUpdate: false,
  status: "ready",
  message: "準備済み",
  updateMessage: "CLI の更新は不要です。",
};

const state: WorkflowsManagementState = {
  target: WORKFLOWS_TARGET_VERSION,
  root: "project",
  projectPin: "2.8.0",
  status: "update",
  message: "更新があります。",
  canInstall: false,
  canUpdate: true,
  tools: [
    { id: "cursor", label: "Cursor", version: "2.8.0" },
    { id: "claude", label: "Claude Code", version: "2.8.0" },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.isTrusted = true;
  mocks.workspace.workspaceFolders = [{ uri: { fsPath: "project" } }];
  mocks.inspect.mockReturnValue(state);
  mocks.inspectCli.mockReturnValue(cli);
});

describe("workflows update GUI", () => {
  it("keeps CLI and repository actions separate and requires the target runtime before a repository update", () => {
    const postMessage = vi.fn();
    const dom = new JSDOM(
      workflowsUpdateHtml(state, "nonce", {
        ...cli,
        machineVersion: "2.8.0",
        targetInstalled: false,
        canUpdate: true,
      }),
      {
        runScripts: "dangerously",
        beforeParse(window) {
          Object.assign(window, { acquireVsCodeApi: () => ({ postMessage }) });
        },
      },
    );
    try {
      const document = dom.window.document;
      const apply = document.getElementById("apply") as HTMLButtonElement;
      const updateCli = document.getElementById("update-cli") as HTMLButtonElement;
      expect(apply.disabled).toBe(true);
      expect(updateCli.disabled).toBe(false);
      expect((document.getElementById("runtime-required") as HTMLElement).hidden).toBe(false);
      updateCli.click();
      expect(postMessage).toHaveBeenLastCalledWith({ type: "update-cli" });
      expect(updateCli.disabled).toBe(true);
      dom.window.dispatchEvent(
        new dom.window.MessageEvent("message", { data: { type: "cli-state", state: cli } }),
      );
      expect(apply.disabled).toBe(true);
      dom.window.dispatchEvent(
        new dom.window.MessageEvent("message", {
          data: { type: "done", scope: "cli", message: "CLI 更新済み" },
        }),
      );
      expect(apply.disabled).toBe(false);
      expect(updateCli.disabled).toBe(true);
      expect(document.getElementById("cli-result")?.textContent).toBe("CLI 更新済み");
      expect(document.getElementById("result")?.textContent).toBe("");
      expect((document.getElementById("runtime-required") as HTMLElement).hidden).toBe(true);
      dom.window.dispatchEvent(
        new dom.window.MessageEvent("message", {
          data: { type: "cli-state", state: { ...cli, launcherReady: false, canUpdate: true } },
        }),
      );
      expect(apply.disabled).toBe(true);
      expect(updateCli.disabled).toBe(false);
      expect((document.getElementById("runtime-required") as HTMLElement).hidden).toBe(false);
    } finally {
      dom.window.close();
    }
  });
  it("does not enable repository updates for an installed runtime with missing launcher files", () => {
    const dom = new JSDOM(
      workflowsUpdateHtml(state, "nonce", { ...cli, launcherReady: false, canUpdate: true }),
    );
    try {
      expect((dom.window.document.getElementById("apply") as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect((dom.window.document.getElementById("update-cli") as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect((dom.window.document.getElementById("runtime-required") as HTMLElement).hidden).toBe(
        false,
      );
    } finally {
      dom.window.close();
    }
  });
  it("runs CLI updates and Doctor independently against the host root, then reinspects both states", async () => {
    const webview = { html: "", postMessage: vi.fn(), onDidReceiveMessage: vi.fn() };
    mocks.create.mockReturnValue({ webview, onDidDispose: vi.fn() });
    const context = {
      workspaceState: { get: vi.fn(), update: vi.fn() },
    } as unknown as ExtensionContext;
    mocks.updateCli.mockResolvedValue({
      ok: true,
      stage: "complete",
      message: "CLI 完了",
      nextAction: "",
      applied: true,
      recovery: "not-needed",
      details: "",
    });
    mocks.doctor.mockResolvedValue({ ok: true, message: "Doctor 完了" });
    await openWorkflowsUpdatePanel(context, "project");
    const receive = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    await receive({ type: "update-cli", workspaceRoot: "attacker", target: "9.0.0" });
    expect(mocks.updateCli).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceRoot: "project" }),
    );
    expect(mocks.updateCli.mock.calls[0]?.[0]).not.toHaveProperty("target");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: "done",
      scope: "cli",
      message: "CLI 完了",
    });
    expect(webview.postMessage).toHaveBeenCalledWith({ type: "cli-state", state: cli });
    await receive({ type: "doctor", workspaceRoot: "attacker" });
    expect(mocks.doctor).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceRoot: "project" }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateCli).toHaveBeenCalledOnce();
    await receive({ type: "setup", workspaceRoot: "attacker" });
    expect(mocks.commands).toHaveBeenCalledWith("aidlc-guide.setup", "project");
    await receive({ type: "extension-update" });
    expect(mocks.commands).toHaveBeenCalledWith("aidlc-guide.checkUpdate");
  });
  it("distinguishes applied settings with failed diagnostics from preflight and partial failures", () => {
    const result = { ok: false, target: WORKFLOWS_TARGET_VERSION };
    expect(workflowsUpdateMessage({ ...result, reason: "doctor" }, [])).toContain(
      "設定反映済み・診断未完了",
    );
    expect(workflowsUpdateMessage({ ...result, reason: "doctor" }, [])).toContain(
      "Doctor を再実行",
    );
    expect(workflowsUpdateMessage({ ...result, reason: "runtime-required" }, [])).toContain(
      "先に「CLI を更新」",
    );
    expect(workflowsUpdateMessage({ ...result, reason: "preflight" }, [])).toContain(
      "エンジンは未更新",
    );
    expect(
      workflowsUpdateMessage(result, [
        { id: "claude", status: "completed", message: "applied" },
        { id: "cursor", status: "failed", message: "failed" },
        { id: "codex", status: "pending", message: "pending" },
      ]),
    ).toContain("設定反映済み 1 件、失敗 1 件、未実行 1 件");
    const failed = cliUpdateMessage({
      ok: false,
      stage: "install",
      message: "取得に失敗",
      details: "timeout",
      applied: true,
      recovery: "restored",
      nextAction: "通信を確認してください。",
    });
    expect(failed).toContain("CLI の導入で停止");
    expect(failed).toContain("以前の既定版に戻しました");
    expect(failed).toContain("通信を確認");
  });
  it("shows rollback failures alongside the original failure and explains a missing previous runtime", () => {
    const result = { ok: false, target: WORKFLOWS_TARGET_VERSION };
    for (const reason of ["preflight", "pin-failed", "cancelled", "claude, cursor"]) {
      const message = workflowsUpdateMessage({ ...result, reason, recovery: "failed" }, []);
      expect(message).toContain("以前の版への復元にも失敗");
      expect(message).toContain(".aidlc-version と CLI の版");
      expect(message).not.toContain("復元を確認しました");
    }
    expect(
      workflowsUpdateMessage({ ...result, reason: "preflight", recovery: "restored" }, []),
    ).toContain("更新前の版への復元を確認しました");
    const missing = workflowsUpdateMessage({ ...result, reason: "previous-runtime-required" }, []);
    expect(missing).toContain("更新前に停止");
    expect(missing).toContain("旧固定版の CLI を公式手順で復元");
    expect(missing).toContain("設定は変更していません");
  });
  it("renders grouped conflicts as text and enables only available repair tools", () => {
    const postMessage = vi.fn();
    const dom = new JSDOM(workflowsUpdateHtml(state, "nonce", cli), {
      runScripts: "dangerously",
      beforeParse(window) {
        Object.assign(window, { acquireVsCodeApi: () => ({ postMessage }) });
      },
    });
    try {
      const send = (data: unknown) =>
        dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data }));
      send({
        type: "problems",
        problems: [
          {
            harness: "claude",
            label: "Claude Code",
            kind: "ownership",
            path: '<img src=x onerror="alert(1)">',
            detail: "unowned",
            guidance: "管理元を確認",
          },
          {
            harness: "claude",
            label: "Claude Code",
            kind: "other",
            path: "設定全体",
            detail: "config failed",
            guidance: "設定を確認",
          },
        ],
      });
      send({
        type: "repair-tools",
        tools: [
          { tool: "claude", label: "Claude Code", available: true },
          { tool: "copilot", label: "Copilot", available: false },
        ],
      });
      const document = dom.window.document;
      expect(document.querySelectorAll("img")).toHaveLength(0);
      expect(document.getElementById("problems")?.textContent).toContain("Claude Code：1 件");
      const items = document.querySelectorAll("#problems li");
      expect(items).toHaveLength(2);
      expect(items[0]?.querySelectorAll("button")).toHaveLength(1);
      expect(items[1]?.textContent).toContain("設定全体");
      expect(items[1]?.querySelectorAll("button")).toHaveLength(0);
      (document.querySelector("#problems li button") as HTMLButtonElement).click();
      expect(postMessage).toHaveBeenLastCalledWith({ type: "problem-file", index: 0 });
      expect(
        (document.querySelector('#repair-tool option[value=""]') as HTMLOptionElement).disabled,
      ).toBe(true);
      (document.getElementById("repair") as HTMLButtonElement).click();
      expect(postMessage).toHaveBeenLastCalledWith({ type: "repair", tool: "claude" });
      expect((document.getElementById("apply") as HTMLButtonElement).disabled).toBe(true);
      (document.getElementById("cancel-repair") as HTMLButtonElement).click();
      expect(postMessage).toHaveBeenLastCalledWith({ type: "cancel-repair" });
      send({ type: "problems", problems: [], message: "解消しました" });
      send({ type: "repair-done", message: "反映しました", ready: true });
      expect(document.getElementById("apply")?.textContent).toContain("更新を再開");
      expect((document.getElementById("repair") as HTMLButtonElement).disabled).toBe(true);
    } finally {
      dom.window.close();
    }
  });
  it("repairs only the host's root, supports cancellation and exposes the fresh diagnostic list", async () => {
    const webview = { html: "", postMessage: vi.fn(), onDidReceiveMessage: vi.fn() };
    mocks.create.mockReturnValue({ webview, onDidDispose: vi.fn() });
    const context = {
      globalStorageUri: { fsPath: "storage" },
      workspaceState: { get: vi.fn(), update: vi.fn() },
    } as unknown as ExtensionContext;
    await openWorkflowsUpdatePanel(context, "project");
    const receive = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    mocks.repair.mockImplementation(async (opts) => {
      expect(opts.root).toBe("project");
      expect(opts.tool).toBe("claude");
      await receive({ type: "cancel-repair" });
      expect(opts.signal.aborted).toBe(true);
      return { problems: [], message: "中止しました" };
    });
    await receive({ type: "repair", root: "attacker", tool: "claude" });
    expect(mocks.repair).toHaveBeenCalledOnce();
    await receive({ type: "repair", tool: "unsupported" });
    expect(mocks.repair).toHaveBeenCalledOnce();
    mocks.repair.mockResolvedValue({
      problems: [
        {
          harness: "claude",
          path: ".gitignore",
          kind: "legacy-root",
          detail: "legacy",
          guidance: "設定を確認",
        },
      ],
      message: "1件",
    });
    await receive({ type: "diagnose" });
    await receive({ type: "copy-diagnosis" });
    expect(JSON.parse(mocks.clipboard.mock.calls[0]?.[0]).problems[0].path).toBe(".gitignore");
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "problems",
        problems: [expect.objectContaining({ label: "Claude Code" })],
      }),
    );
    mocks.update.mockResolvedValue({
      ok: false,
      reason: "preflight",
      target: WORKFLOWS_TARGET_VERSION,
      problems: [],
    });
    await receive({ type: "apply" });
    await receive({ type: "copy-diagnosis" });
    expect(JSON.parse(mocks.clipboard.mock.lastCall?.[0]).problems).toEqual([]);
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "problems", problems: [] }),
    );
  });
  it("restores the old pin and machine default when the panel closes before configuration", async () => {
    const webview = { html: "", postMessage: vi.fn(), onDidReceiveMessage: vi.fn() };
    const onDidDispose = vi.fn();
    const dispose = vi.fn(() => onDidDispose.mock.calls[0]?.[0]());
    const unsubscribe = vi.fn();
    mocks.workspace.onDidChangeWorkspaceFolders.mockReturnValue({ dispose: unsubscribe });
    mocks.create.mockReturnValue({ webview, onDidDispose, dispose });
    const runtime = {
      version: WORKFLOWS_TARGET_VERSION,
      executable: "/user/aidlc",
      binDir: "/user/bin",
    };
    const use = vi.fn();
    const pin = vi.fn(async () => {
      dispose();
    });
    const configure = vi.fn();
    mocks.update.mockImplementation(async (opts) => {
      const result = await applyNativeWorkflowsUpdate({
        ...opts,
        pin: WORKFLOWS_TARGET_VERSION,
        selected: ["cursor"],
        detected: ["cursor"],
        hooks: {
          readActive: () => ({ ...runtime, version: NEWER_WORKFLOWS_VERSION }),
          readInstall: () => runtime,
          readProjectPin: () => "2.8.0",
          readWorkspaceVersions: () => ["2.8.0"],
          use,
          pin,
          configure,
        },
      });
      expect(result).toMatchObject({ ok: false, reason: "cancelled" });
      expect(opts.isCurrent()).toBe(false);
      expect(opts.signal.aborted).toBe(true);
      expect(opts.canRestore()).toBe(true);
      mocks.workspace.isTrusted = false;
      expect(opts.canRestore()).toBe(false);
      return result;
    });
    const context = { workspaceState: { get: vi.fn() } } as unknown as ExtensionContext;
    await openWorkflowsUpdatePanel(context, "project");
    await webview.onDidReceiveMessage.mock.calls[0]?.[0]({ type: "apply" });
    expect(use.mock.calls.map((call) => call[1])).toEqual([
      WORKFLOWS_TARGET_VERSION,
      NEWER_WORKFLOWS_VERSION,
    ]);
    expect(pin.mock.calls.map((call) => call[2])).toEqual([WORKFLOWS_TARGET_VERSION, "2.8.0"]);
    expect(configure).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
    expect(webview.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "done" }));
  });
  it("disposes a stale panel when its folder is removed from a multi-root workspace", async () => {
    const webview = { html: "", postMessage: vi.fn(), onDidReceiveMessage: vi.fn() };
    const onDidDispose = vi.fn();
    const dispose = vi.fn(() => onDidDispose.mock.calls[0]?.[0]());
    const unsubscribe = vi.fn();
    mocks.workspace.onDidChangeWorkspaceFolders.mockReturnValue({ dispose: unsubscribe });
    mocks.create.mockReturnValue({ webview, onDidDispose, dispose });
    mocks.workspace.workspaceFolders.push({ uri: { fsPath: "other" } });
    mocks.update.mockImplementation(async (opts) => {
      mocks.workspace.workspaceFolders = [{ uri: { fsPath: "other" } }];
      mocks.workspace.onDidChangeWorkspaceFolders.mock.calls[0]?.[0]();
      expect(opts.isCurrent()).toBe(false);
      expect(opts.signal.aborted).toBe(true);
      expect(opts.canRestore()).toBe(false);
      mocks.workspace.workspaceFolders.push({ uri: { fsPath: "project" } });
      expect(opts.canRestore()).toBe(false);
      return { ok: false, target: WORKFLOWS_TARGET_VERSION };
    });
    const context = { workspaceState: { get: vi.fn() } } as unknown as ExtensionContext;
    await openWorkflowsUpdatePanel(context, "project");
    const receive = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    await receive({ type: "apply" });
    expect(dispose).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
    await receive({ type: "apply" });
    expect(mocks.update).toHaveBeenCalledOnce();
  });
  it("lists all versions without selection and sends only an apply request", () => {
    const postMessage = vi.fn();
    const dom = new JSDOM(
      workflowsUpdateHtml({ ...state, root: "project<script>" }, "nonce", cli),
      {
        runScripts: "dangerously",
        beforeParse(window) {
          Object.assign(window, { acquireVsCodeApi: () => ({ postMessage }) });
        },
      },
    );
    try {
      const document = dom.window.document;
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
      expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
      expect(document.querySelectorAll("script")).toHaveLength(1);
      expect(document.body.textContent).toContain("project<script>");
      const button = document.getElementById("apply") as HTMLButtonElement;
      expect(button.textContent).toContain("プロジェクトのエンジンを更新");
      button.click();
      expect(postMessage).toHaveBeenLastCalledWith({ type: "apply" });
      expect(button.disabled).toBe(true);
      dom.window.dispatchEvent(
        new dom.window.MessageEvent("message", { data: { type: "done", message: "未完了" } }),
      );
      expect(button.disabled).toBe(false);
      dom.window.dispatchEvent(
        new dom.window.MessageEvent("message", {
          data: { type: "state", state: { ...state, canUpdate: false, message: "更新不要" } },
        }),
      );
      expect(button.disabled).toBe(true);
      expect(document.getElementById("state")?.textContent).toBe("更新不要");
    } finally {
      dom.window.close();
    }
  });
  it("routes host-owned roots to the shared service, stores failures and permits retry", async () => {
    const webview = { html: "", postMessage: vi.fn(), onDidReceiveMessage: vi.fn() };
    mocks.create.mockReturnValue({ webview, onDidDispose: vi.fn() });
    const stored = new Map<string, unknown>();
    const context = {
      workspaceState: {
        get: (key: string) => stored.get(key),
        update: async (key: string, value: unknown) => {
          stored.set(key, value);
        },
      },
    } as unknown as ExtensionContext;
    let attempts = 0;
    mocks.update.mockImplementation(async (opts) => {
      expect(opts.workspaceRoot).toBe("project");
      expect(opts).not.toHaveProperty("selected");
      expect(opts).not.toHaveProperty("pin");
      if (attempts++ > 0) expect(opts.needsRepair).toBe(true);
      await opts.setNeedsRepair(true);
      opts.onHarnessResult({ id: "cursor", status: "failed", message: "再実行してください" });
      return { ok: false, target: WORKFLOWS_TARGET_VERSION };
    });
    await openWorkflowsUpdatePanel(context, "project");
    const receive = webview.onDidReceiveMessage.mock.calls[0]?.[0];
    await receive({ type: "apply", workspaceRoot: "other", selected: ["cursor"], pin: "9.0.0" });
    await receive({ type: "apply" });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "results",
        results: [expect.objectContaining({ label: "Cursor", status: "failed" })],
      }),
    );
    expect(webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "done",
        message: expect.stringContaining("完了していません"),
      }),
    );
    await receive({ type: "install" });
    expect(mocks.commands).toHaveBeenCalledWith("aidlc-guide.installWorkflows", "project");
    mocks.workspace.isTrusted = false;
    await receive({ type: "apply" });
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
});
