import { WORKFLOWS_TARGET_VERSION, type WorkflowsManagementState } from "@aidlc-guide/shared-types";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { NEWER_WORKFLOWS_VERSION } from "./workflows-version-fixture.ts";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  inspect: vi.fn(),
  update: vi.fn(),
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
vi.mock("../src/workflows-repair.ts", () => ({
  repairWorkflows: mocks.repair,
  probeRepairTools: mocks.probe,
  REPAIR_TOOLS: ["claude", "cursor", "copilot"],
}));

import { applyNativeWorkflowsUpdate } from "../src/workflows-native-update.ts";
import { openWorkflowsUpdatePanel, workflowsUpdateHtml } from "../src/workflows-update-panel.ts";

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
});

describe("workflows update GUI", () => {
  it("renders grouped conflicts as text and enables only available repair tools", () => {
    const postMessage = vi.fn();
    const dom = new JSDOM(workflowsUpdateHtml(state, "nonce"), {
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
    const dom = new JSDOM(workflowsUpdateHtml({ ...state, root: "project<script>" }, "nonce"), {
      runScripts: "dangerously",
      beforeParse(window) {
        Object.assign(window, { acquireVsCodeApi: () => ({ postMessage }) });
      },
    });
    try {
      const document = dom.window.document;
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
      expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
      expect(document.querySelectorAll("script")).toHaveLength(1);
      expect(document.body.textContent).toContain("project<script>");
      const button = document.getElementById("apply") as HTMLButtonElement;
      expect(button.textContent).toContain(WORKFLOWS_TARGET_VERSION);
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
