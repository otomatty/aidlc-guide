import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  watcherDispose: vi.fn(),
  item: { text: "", tooltip: "", command: "", show: vi.fn() },
}));
vi.mock("@aidlc-guide/api-core", () => ({
  createGuideService: mocks.create,
  routePost: vi.fn(),
  routeRead: vi.fn(),
  UNKNOWN_ROUTE: {},
}));
vi.mock("vscode", () => ({
  RelativePattern: class {},
  workspace: {
    createFileSystemWatcher: () => ({ onDidCreate: vi.fn(), dispose: mocks.watcherDispose }),
  },
  StatusBarAlignment: { Left: 1 },
  window: { createStatusBarItem: () => mocks.item },
}));
vi.mock("../src/official-docs-root.ts", () => ({ resolveOfficialDocsRoot: () => "docs" }));

import { acquireSession, closeAllSessions, disposeAllSessions } from "../src/guide-session.ts";
import { createStatusBar, startStatusBarRefresh } from "../src/status-bar.ts";

function service() {
  const unwatch = vi.fn();
  return {
    unwatch,
    startWatch: vi.fn(() => unwatch),
    startMatrixBackground: vi.fn(),
    hub: { add: vi.fn(), remove: vi.fn() },
    reader: {
      getWorkflow: vi.fn().mockResolvedValue({ ok: true, value: { currentStage: null } }),
      getTimings: vi.fn().mockResolvedValue({ error: true }),
    },
  };
}
const context = () =>
  ({
    extensionPath: "extension",
    subscriptions: [],
    workspaceState: { get: vi.fn() },
  }) as unknown as ExtensionContext;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.create.mockImplementation(service);
});
afterEach(async () => {
  await closeAllSessions();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("workspace session ownership", () => {
  it("waits for released sessions as well as current ones, while dispose stays synchronous", async () => {
    let finishReleased = () => {};
    const releasedClose = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishReleased = resolve;
        }),
    );
    let finishCurrent = () => {};
    const currentClose = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCurrent = resolve;
        }),
    );
    mocks.create.mockReturnValueOnce({ ...service(), customizationAi: { close: releasedClose } });
    const released = acquireSession("released");
    expect(released.dispose()).toBeUndefined();
    expect(released.session.dispose()).toBeUndefined();
    expect(releasedClose).toHaveBeenCalledOnce();
    mocks.create.mockReturnValueOnce({ ...service(), customizationAi: { close: currentClose } });
    acquireSession("current");
    const closing = closeAllSessions();
    let settled = false;
    void closing.then(() => {
      settled = true;
    });
    expect(currentClose).toHaveBeenCalledOnce();
    finishCurrent();
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    finishReleased();
    await closing;
    expect(settled).toBe(true);
    await closeAllSessions();
    expect(releasedClose).toHaveBeenCalledOnce();
    expect(currentClose).toHaveBeenCalledOnce();
  });

  it("reports a released session's failure at deactivation after waiting for other sessions", async () => {
    const failure = new Error("AI shutdown timed out");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockReturnValueOnce({
      ...service(),
      customizationAi: { close: vi.fn().mockRejectedValue(failure) },
    });
    acquireSession("failed").dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toHaveBeenCalledWith("AIDLC Guide session shutdown failed", failure);
    let finish = () => {};
    mocks.create.mockReturnValueOnce({
      ...service(),
      customizationAi: {
        close: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      },
    });
    acquireSession("pending");
    const closing = closeAllSessions();
    const failed = expect(closing).rejects.toMatchObject({ errors: [failure] });
    let settled = false;
    void closing.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    finish();
    await failed;
    log.mockRestore();
  });

  it("stops each obsolete status-bar watcher and releases the cached session", () => {
    const ctx = context();
    createStatusBar(ctx);
    for (const root of ["a", "b", "c"]) {
      const refresh = startStatusBarRefresh(ctx, root);
      const created = mocks.create.mock.results.at(-1)?.value;
      refresh.dispose();
      refresh.dispose();
      expect(created.unwatch).toHaveBeenCalledTimes(1);
    }
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.watcherDispose).toHaveBeenCalledTimes(3);
    const reopened = acquireSession("a");
    expect(mocks.create).toHaveBeenCalledTimes(4);
    reopened.dispose();
  });

  it("keeps the shared session alive until both status bar and dashboard release it", () => {
    const refresh = startStatusBarRefresh(context(), "a");
    const dashboard = acquireSession("a");
    const created = mocks.create.mock.results[0]?.value;
    expect(mocks.create).toHaveBeenCalledTimes(1);
    refresh.dispose();
    expect(created.unwatch).not.toHaveBeenCalled();
    dashboard.dispose();
    dashboard.dispose();
    expect(created.unwatch).toHaveBeenCalledTimes(1);
  });

  it("does not release a replacement session through an old lease after deactivation", () => {
    const old = acquireSession("a");
    disposeAllSessions();
    const current = acquireSession("a");
    const created = mocks.create.mock.results[1]?.value;
    old.dispose();
    expect(created.unwatch).not.toHaveBeenCalled();
    current.dispose();
    expect(created.unwatch).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "ignores an old status read after folder replacement, including failure=%s",
    async (fails) => {
      const ctx = context();
      createStatusBar(ctx);
      let finish: () => void = () => {};
      const oldService = service();
      oldService.reader.getWorkflow.mockReturnValueOnce(
        new Promise((resolve, reject) => {
          finish = () =>
            fails
              ? reject(new Error("removed"))
              : resolve({ ok: true, value: { currentStage: "old", phase: "construction" } });
        }),
      );
      mocks.create.mockReturnValueOnce(oldService);
      const old = startStatusBarRefresh(ctx, "a");
      old.dispose();
      const nextService = service();
      nextService.reader.getWorkflow.mockResolvedValue({
        ok: true,
        value: { currentStage: "new", phase: "inception" },
      });
      mocks.create.mockReturnValueOnce(nextService);
      const next = startStatusBarRefresh(ctx, "b");
      await Promise.resolve();
      finish();
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.item.text).toContain("new");
      expect(oldService.unwatch).toHaveBeenCalledTimes(1);
      next.dispose();
    },
  );
});
