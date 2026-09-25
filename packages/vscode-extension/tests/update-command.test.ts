import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import type { ApplyReleaseResult } from "../src/release-apply.ts";
import { applySuccessMessage, RELOAD_ACTION, UPDATE_ACTION } from "../src/update-feedback.ts";

const mocks = vi.hoisted(() => ({
  registerCommand: vi.fn(),
  executeCommand: vi.fn().mockResolvedValue(undefined),
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn(),
  withProgress: vi.fn(async (_options: unknown, task: () => Promise<unknown>) => task()),
  confirmNewerRelease: vi.fn(),
  applyReleaseFromUrl: vi.fn(),
}));

vi.mock("vscode", () => ({
  commands: { registerCommand: mocks.registerCommand, executeCommand: mocks.executeCommand },
  extensions: {},
  ProgressLocation: { Notification: 15 },
  Uri: {},
  window: {
    showInformationMessage: mocks.showInformationMessage,
    showErrorMessage: mocks.showErrorMessage,
    withProgress: mocks.withProgress,
  },
  workspace: {},
}));
vi.mock("../src/release-lookup.ts", () => ({ confirmNewerRelease: mocks.confirmNewerRelease }));
vi.mock("../src/release-apply.ts", () => ({ applyReleaseFromUrl: mocks.applyReleaseFromUrl }));

async function runUpdate(): Promise<void> {
  const { registerApplyLatestCommand } = await import("../src/write-global-vsix.ts");
  registerApplyLatestCommand({
    extension: { packageJSON: { version: "0.1.0" } },
    subscriptions: [],
  } as unknown as ExtensionContext);
  const handler = mocks.registerCommand.mock.calls.find(
    ([command]) => command === "aidlc-guide.checkUpdate",
  )?.[1] as () => Promise<void>;
  await handler();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.confirmNewerRelease.mockResolvedValue({
    version: "0.2.0",
    tag: "v0.2.0",
    assetName: "aidlc-guide-0.2.0.vsix",
    notes: [],
  });
  mocks.applyReleaseFromUrl.mockResolvedValue({ ok: true });
  mocks.showInformationMessage.mockResolvedValue(undefined);
});

describe("更新コマンドの完了通知", () => {
  it("インストール完了後にトーストを表示し、選択された場合だけ再読み込みする", async () => {
    const installation = Promise.withResolvers<ApplyReleaseResult>();
    mocks.applyReleaseFromUrl.mockReturnValue(installation.promise);
    mocks.showInformationMessage.mockResolvedValue(RELOAD_ACTION);

    const update = runUpdate();
    await vi.waitFor(() => expect(mocks.applyReleaseFromUrl).toHaveBeenCalledOnce(), {
      timeout: 10_000,
    });
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
    expect(mocks.executeCommand).not.toHaveBeenCalled();

    installation.resolve({ ok: true });
    await update;
    expect(mocks.withProgress).toHaveBeenCalledWith(
      { location: 15, title: "AIDLC Guide 0.2.0 を更新しています…" },
      expect.any(Function),
    );
    expect(mocks.showInformationMessage).toHaveBeenCalledExactlyOnceWith(
      applySuccessMessage("0.2.0"),
      RELOAD_ACTION,
    );
    expect(mocks.executeCommand).toHaveBeenCalledExactlyOnceWith("workbench.action.reloadWindow");
  });

  it("トーストを閉じた場合は再読み込みしない", async () => {
    await runUpdate();
    expect(mocks.showInformationMessage).toHaveBeenCalledOnce();
    expect(mocks.executeCommand).not.toHaveBeenCalled();
  });

  it("インストール失敗時はエラーを通知し、完了通知や再読み込みを行わない", async () => {
    mocks.applyReleaseFromUrl.mockResolvedValue({ ok: false, reason: "install", detail: "失敗" });
    await runUpdate();
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("インストールに失敗"),
    );
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
    expect(mocks.executeCommand).not.toHaveBeenCalled();
  });
});

describe("更新の確認ダイアログ", () => {
  async function confirmWith(notes: string[]): Promise<unknown> {
    mocks.confirmNewerRelease.mockResolvedValue(undefined);
    await runUpdate();
    const confirm = mocks.confirmNewerRelease.mock.calls[0]?.[1] as (release: {
      version: string;
      notes: string[];
    }) => Promise<boolean>;
    mocks.showInformationMessage.mockResolvedValue(UPDATE_ACTION);
    return confirm({ version: "0.2.0", notes });
  }

  it("shows the offered version's main changes before asking", async () => {
    await expect(confirmWith(["はじめにを追加"])).resolves.toBe(true);
    expect(mocks.showInformationMessage).toHaveBeenCalledExactlyOnceWith(
      "新しいバージョン 0.2.0 があります。更新しますか？",
      { modal: true, detail: "0.2.0 の主な変更:\n・はじめにを追加" },
      UPDATE_ACTION,
    );
  });

  it("asks without details when the release lists no changes", async () => {
    await confirmWith([]);
    expect(mocks.showInformationMessage).toHaveBeenCalledExactlyOnceWith(
      "新しいバージョン 0.2.0 があります。更新しますか？",
      { modal: true },
      UPDATE_ACTION,
    );
  });
});
