import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";

const mocks = vi.hoisted(() => ({ show: vi.fn(), create: vi.fn(), status: vi.fn() }));
vi.mock("vscode", () => ({
  window: { showInformationMessage: mocks.show, createWebviewPanel: mocks.create },
  commands: {},
  env: {},
  Uri: {},
  ViewColumn: { One: 1 },
  workspace: {},
}));
vi.mock("../src/official-docs-root.ts", () => ({ resolveOfficialDocsRoot: () => "docs" }));
vi.mock("../src/workflows-version.ts", async (original) => ({
  ...(await original<typeof import("../src/workflows-version.ts")>()),
  resolveWorkflowsStatus: mocks.status,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.status.mockReturnValue({ kind: "older", workspace: "2.7.0", pin: "2.8.0" });
});

describe("workspace update prompts", () => {
  it("checks a replacement folder independently and ignores a stale notification response", async () => {
    const { maybePromptWorkflowsUpdate } = await import("../src/workflows-update-panel.ts");
    const context = {
      extensionPath: "extension",
      workspaceState: { get: vi.fn(), update: vi.fn() },
    } as unknown as ExtensionContext;
    let current = "a";
    let replyA: (value: string) => void = () => {};
    mocks.show.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        replyA = resolve;
      }),
    );
    mocks.show.mockResolvedValue(undefined);
    const first = maybePromptWorkflowsUpdate(context, "a", () => current === "a");
    current = "b";
    await maybePromptWorkflowsUpdate(context, "b", () => current === "b");
    replyA("アップデートする");
    await first;
    expect(mocks.status.mock.calls.map(([root]) => root)).toEqual(["a", "b"]);
    expect(mocks.show).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(context.workspaceState.update).not.toHaveBeenCalled();
  });

  it("replaces a cancelled generation for the same folder", async () => {
    const { maybePromptWorkflowsUpdate } = await import("../src/workflows-update-panel.ts");
    const context = {
      extensionPath: "extension",
      workspaceState: { get: vi.fn(), update: vi.fn() },
    } as unknown as ExtensionContext;
    let generation = 1;
    let reply: (value: string) => void = () => {};
    mocks.show.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        reply = resolve;
      }),
    );
    mocks.show.mockResolvedValue(undefined);
    const first = maybePromptWorkflowsUpdate(context, "a", () => generation === 1);
    generation = 2;
    await maybePromptWorkflowsUpdate(context, "a", () => generation === 2);
    reply("後で");
    await first;
    expect(mocks.show).toHaveBeenCalledTimes(2);
    expect(context.workspaceState.update).not.toHaveBeenCalled();
  });
});
