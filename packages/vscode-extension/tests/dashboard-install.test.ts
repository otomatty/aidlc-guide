import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  receive: vi.fn(),
}));
vi.mock("vscode", () => ({
  commands: { executeCommand: mocks.execute },
  env: {},
  Uri: { file: (fsPath: string) => ({ fsPath }) },
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: () => ({
      webview: { html: "", onDidReceiveMessage: mocks.receive },
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
  getLastOfficialDocsLocale: vi.fn(),
  handleOpenOfficialDoc: vi.fn(),
  injectDocsShellDeepLink: vi.fn(),
  OFFICIAL_DOCS_LOCALE_KEY: "locale",
}));
vi.mock("../src/workflows-update-panel.ts", () => ({ maybePromptWorkflowsUpdate: vi.fn() }));
vi.mock("../src/write-global-vsix.ts", () => ({ registerApplyLatestCommand: vi.fn() }));

import { openDashboardPanel } from "../src/dashboard-panel.ts";

beforeEach(() => vi.clearAllMocks());

describe("dashboard workflows installation", () => {
  it("uses the host's dashboard workspace even when the message supplies a different path", async () => {
    openDashboardPanel(
      { extensionPath: "extension", subscriptions: [] } as unknown as ExtensionContext,
      "dashboard-project",
    );
    const receive = mocks.receive.mock.calls[0]?.[0];
    await receive({ type: "open-workflows-install", workspaceRoot: "unrelated-project" });
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(
      "aidlc-guide.installWorkflows",
      "dashboard-project",
    );
  });
});
