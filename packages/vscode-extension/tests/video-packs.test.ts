import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  receive: vi.fn((_listener: unknown) => ({ dispose: vi.fn() })),
  post: vi.fn(),
  handleGet: vi.fn(async () => ({ reached: true, body: { ok: true } })),
  extensions: [] as { id: string; extensionPath: string; packageJSON: unknown }[],
  changeListeners: [] as (() => void)[],
  panel: undefined as
    | undefined
    | { webview: { options: Record<string, unknown> }; options: Record<string, unknown> },
  disposeWatch: vi.fn(),
  onDispose: undefined as undefined | (() => void),
}));

vi.mock("vscode", () => ({
  commands: {},
  env: {},
  extensions: {
    get all() {
      return mocks.extensions;
    },
    onDidChange: (listener: () => void) => {
      mocks.changeListeners.push(listener);
      return { dispose: mocks.disposeWatch };
    },
  },
  Uri: { file: (fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` }) },
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: (_type: string, _title: string, _column: number, options: Record<string, unknown>) => {
      const panel = {
        options,
        webview: {
          html: "",
          options,
          onDidReceiveMessage: mocks.receive,
          postMessage: mocks.post,
          asWebviewUri: (uri: { fsPath: string }) => ({ toString: () => `webview-resource:${uri.fsPath}` }),
        },
        onDidDispose: (fn: () => void) => {
          mocks.onDispose = fn;
        },
      };
      mocks.panel = panel;
      return panel;
    },
  },
}));
vi.mock("../src/commands.ts", () => ({ runInTerminal: vi.fn() }));
vi.mock("../src/dashboard-html.ts", () => ({ loadDashboardHtml: async () => "<html></html>" }));
vi.mock("../src/doctor.ts", () => ({ onPath: vi.fn() }));
vi.mock("../src/guide-session.ts", () => ({
  acquireSession: () => ({
    session: { subscribe: () => vi.fn(), handleGet: mocks.handleGet },
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
import { discoverVideoPacks, installedVideoPacks, videoPackRoots } from "../src/video-packs.ts";

const PACK_JSON = {
  version: "0.1.0",
  contributes: {
    aidlcGuideVideoPacks: [{ id: "official-ja", locale: "ja", formatVersion: 1, root: "media/videos" }],
  },
};

const context = {
  extensionPath: "/ext/guide",
  subscriptions: [],
  workspaceState: { get: () => undefined, update: vi.fn() },
  globalState: { get: () => undefined, update: vi.fn() },
} as unknown as ExtensionContext;

function roots(): string[] {
  const options = mocks.panel?.webview.options as { localResourceRoots: { fsPath: string }[] };
  return options.localResourceRoots.map((u) => u.fsPath);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.extensions = [];
  mocks.changeListeners = [];
});

describe("discoverVideoPacks", () => {
  it("collects packs from trusted extensions only and ignores the rest", () => {
    const warn = vi.fn();
    const packs = discoverVideoPacks(
      [
        { id: "aidlc.aidlc-guide-videos-ja", extensionPath: "/ext/ja", packageJSON: PACK_JSON },
        { id: "someone.videos", extensionPath: "/ext/evil", packageJSON: PACK_JSON },
        { id: "ms-python.python", extensionPath: "/ext/py", packageJSON: { contributes: {} } },
        {
          id: "aidlc.future",
          extensionPath: "/ext/future",
          packageJSON: {
            ...PACK_JSON,
            contributes: { aidlcGuideVideoPacks: [{ ...PACK_JSON.contributes.aidlcGuideVideoPacks[0], formatVersion: 9 }] },
          },
        },
      ],
      warn,
    );
    expect(packs).toEqual([
      {
        extensionPath: "/ext/ja",
        source: { extensionId: "aidlc.aidlc-guide-videos-ja", version: "0.1.0", id: "official-ja", locale: "ja", root: "media/videos" },
      },
    ]);
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining("someone.videos"),
      expect.stringContaining("unsupported pack format 9"),
    ]);
  });

  it("reports a refused pack once, not on every lookup", () => {
    const warn = vi.fn();
    const bad = [{ id: "aidlc.broken", extensionPath: "/ext/b", packageJSON: { contributes: { aidlcGuideVideoPacks: [] } } }];
    discoverVideoPacks(bad, warn);
    discoverVideoPacks(bad, warn);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("reads the live extension registry", () => {
    mocks.extensions = [{ id: "aidlc.v", extensionPath: "/ext/v", packageJSON: PACK_JSON }];
    expect(installedVideoPacks()).toHaveLength(1);
  });

  it("allows only each pack's media root, once", () => {
    const [pack] = discoverVideoPacks([{ id: "aidlc.v", extensionPath: "/ext/v", packageJSON: PACK_JSON }]);
    expect(pack).toBeDefined();
    if (pack === undefined) return;
    expect(videoPackRoots([pack, pack])).toEqual([path.resolve("/ext/v", "media/videos")]);
  });
});

describe("dashboard panel and video packs", () => {
  it("lets the webview load the dashboard bundle and installed pack media only", () => {
    mocks.extensions = [{ id: "aidlc.v", extensionPath: "/ext/v", packageJSON: PACK_JSON }];
    openDashboardPanel(context, "/work");
    expect(roots()).toEqual([
      path.join("/ext/guide", "media", "dashboard"),
      path.resolve("/ext/v", "media/videos"),
    ]);
  });

  it("widens the allowed roots in place when a pack is installed later", () => {
    openDashboardPanel(context, "/work");
    expect(roots()).toHaveLength(1);
    mocks.extensions = [{ id: "aidlc.v", extensionPath: "/ext/v", packageJSON: PACK_JSON }];
    for (const listener of mocks.changeListeners) listener();
    expect(roots()).toContain(path.resolve("/ext/v", "media/videos"));
    expect(mocks.panel?.webview.options).toMatchObject({ enableScripts: true, retainContextWhenHidden: true });
  });

  it("answers GETs with this webview's resource URLs, and stops watching when closed", async () => {
    openDashboardPanel(context, "/work");
    const receive = mocks.receive.mock.calls.at(-1)?.[0] as (m: unknown) => Promise<void>;
    await receive({ type: "get", id: "1", path: "/api/official-docs/ja/videos/guide/x.md" });
    const call = mocks.handleGet.mock.calls.at(-1) as unknown as [string, (p: string) => string];
    expect(call[0]).toBe("/api/official-docs/ja/videos/guide/x.md");
    expect(call[1]("/ext/v/media/videos/a.opus")).toBe("webview-resource:/ext/v/media/videos/a.opus");
    mocks.onDispose?.();
    expect(mocks.disposeWatch).toHaveBeenCalledOnce();
  });
});
