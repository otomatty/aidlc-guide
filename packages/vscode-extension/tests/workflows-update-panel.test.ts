import { WORKFLOWS_TARGET_VERSION, type WorkflowsManagementState } from "@aidlc-guide/shared-types";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  inspect: vi.fn(),
  update: vi.fn(),
  commands: vi.fn(),
  workspace: { isTrusted: true, workspaceFolders: [{ uri: { fsPath: "project" } }] },
}));
vi.mock("vscode", () => ({
  commands: { executeCommand: mocks.commands },
  env: {},
  Uri: {},
  ViewColumn: { One: 1 },
  window: { createWebviewPanel: mocks.create, showErrorMessage: vi.fn() },
  workspace: mocks.workspace,
}));
vi.mock("../src/workflows-management.ts", () => ({ inspectWorkflowsManagement: mocks.inspect }));
vi.mock("../src/workflows-update.ts", () => ({ updateInstalledWorkflows: mocks.update }));

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
