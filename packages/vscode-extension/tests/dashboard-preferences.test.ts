import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({ receive: vi.fn(), post: vi.fn(), warn: vi.fn() }));
vi.mock("vscode", () => ({
  commands: {},
  env: {},
  Uri: { file: (fsPath: string) => ({ fsPath }) },
  ViewColumn: { One: 1 },
  window: {
    showWarningMessage: mocks.warn,
    createWebviewPanel: () => ({
      webview: { html: "", onDidReceiveMessage: mocks.receive, postMessage: mocks.post },
      onDidDispose: vi.fn(),
    }),
  },
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
  getLastOfficialDocsLocale: () => "ja",
  handleOpenOfficialDoc: vi.fn(),
  injectDocsShellDeepLink: vi.fn(),
  OFFICIAL_DOCS_LOCALE_KEY: "locale",
}));
vi.mock("../src/workflows-update-panel.ts", () => ({ maybePromptWorkflowsUpdate: vi.fn() }));
vi.mock("../src/write-global-vsix.ts", () => ({ registerApplyLatestCommand: vi.fn() }));

import { openDashboardPanel } from "../src/dashboard-panel.ts";

const KEY = "aidlc-guide.nowExpanded";

function workspace(initial?: unknown) {
  const values = new Map<string, unknown>([[KEY, initial]]);
  const update = vi.fn(async (key: string, value: unknown) => {
    values.set(key, value);
  });
  const context = {
    extensionPath: "extension",
    subscriptions: [],
    workspaceState: { get: (key: string) => values.get(key), update },
    globalState: { update: vi.fn() },
  } as unknown as ExtensionContext;
  return { context, update };
}

function open(context: ExtensionContext): (message: unknown) => Promise<void> {
  openDashboardPanel(context, "dashboard-project");
  return mocks.receive.mock.calls.at(-1)?.[0];
}

beforeEach(() => vi.clearAllMocks());

describe("dashboard disclosure workspace preference", () => {
  it.each([undefined, null, "true", 1, {}, false])(
    "restores a missing or invalid preference as closed: %j",
    async (initial) => {
      const { context, update } = workspace(initial);
      await open(context)({ type: "ready" });
      expect(mocks.post).toHaveBeenCalledWith({ type: "now-disclosure", expanded: false });
      expect(mocks.post).toHaveBeenCalledWith({ type: "official-docs-locale", locale: "ja" });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("persists only the boolean in workspaceState and restores it in a new panel", async () => {
    const { context, update } = workspace();
    const first = open(context);
    await first({
      type: "now-disclosure",
      expanded: true,
      intent: "untrusted",
      stage: "old-stage",
    });
    expect(update).toHaveBeenCalledExactlyOnceWith(KEY, true);
    expect(context.globalState.update).not.toHaveBeenCalled();

    const second = open(context);
    await second({ type: "ready" });
    expect(mocks.post).toHaveBeenLastCalledWith({ type: "now-disclosure", expanded: true });

    await second({ type: "now-disclosure", expanded: false });
    await open(context)({ type: "ready" });
    expect(mocks.post).toHaveBeenLastCalledWith({ type: "now-disclosure", expanded: false });
  });

  it.each([undefined, null, "false", 0, {}])("rejects an invalid save: %j", async (expanded) => {
    const { context, update } = workspace(true);
    const receive = open(context);
    await receive({ type: "now-disclosure", expanded });
    expect(update).not.toHaveBeenCalled();
    await receive({ type: "ready" });
    expect(mocks.post).toHaveBeenLastCalledWith({ type: "now-disclosure", expanded: true });
  });

  it("reports a failed save without rejecting the message or reverting the current UI", async () => {
    const { context, update } = workspace(false);
    update.mockRejectedValueOnce(new Error("workspace storage is unavailable"));
    const receive = open(context);

    await expect(receive({ type: "now-disclosure", expanded: true })).resolves.toBeUndefined();

    expect(mocks.warn).toHaveBeenCalledExactlyOnceWith(
      "現在地情報の開閉状態を保存できませんでした。次回起動時に今回の変更が反映されない可能性があります。",
    );
    // Keep the current click in the UI; do not send the old preference back.
    expect(mocks.post).not.toHaveBeenCalled();
    await open(context)({ type: "ready" });
    expect(mocks.post).toHaveBeenLastCalledWith({ type: "now-disclosure", expanded: false });
  });
});
