import { WORKFLOWS_TARGET_VERSION } from "@aidlc-guide/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import type { ApplyReleaseResult } from "../src/release-apply.ts";
import { applySuccessMessage, RELOAD_ACTION, UPDATE_ACTION } from "../src/update-feedback.ts";

const mocks = vi.hoisted(() => ({
  fetchReleaseMetadata: vi.fn(),
  registerCommand: vi.fn(),
  executeCommand: vi.fn().mockResolvedValue(undefined),
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn(),
  gate: vi.fn(),
  workspace: { isTrusted: true, workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined },
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
    showWarningMessage: mocks.showWarningMessage,
    showErrorMessage: mocks.showErrorMessage,
    withProgress: mocks.withProgress,
  },
  workspace: mocks.workspace,
}));
vi.mock("@aidlc-guide/reader-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@aidlc-guide/reader-core")>()),
  inspectVersionGate: mocks.gate,
}));
vi.mock("../src/release-lookup.ts", () => ({
  confirmNewerRelease: mocks.confirmNewerRelease,
  fetchReleaseMetadata: mocks.fetchReleaseMetadata,
}));
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
  mocks.workspace.isTrusted = true;
  mocks.workspace.workspaceFolders = undefined;
  // Releases made before the metadata asset carry none.
  mocks.fetchReleaseMetadata.mockResolvedValue("absent");
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

  it("warns before installing a Guide that supports another aidlc-workflows release", async () => {
    mocks.fetchReleaseMetadata.mockResolvedValue({ version: "0.2.0", workflowsTarget: "99.0.0" });
    await confirmWith([]);
    const options = mocks.showInformationMessage.mock.calls[0]?.[1] as { detail?: string };
    expect(options.detail).toContain(
      `${WORKFLOWS_TARGET_VERSION} から 99.0.0 に更新するまで AIDLC Guide を使えません`,
    );
  });

  it("says compatibility was not checked when the metadata could not be read", async () => {
    mocks.fetchReleaseMetadata.mockResolvedValue("unreadable");
    await confirmWith([]);
    const options = mocks.showInformationMessage.mock.calls[0]?.[1] as { detail?: string };
    expect(options.detail).toContain("対応する aidlc-workflows の版を確認できませんでした");
  });

  it("asks as before when the new Guide supports the same release", async () => {
    mocks.fetchReleaseMetadata.mockResolvedValue({
      version: "0.2.0",
      workflowsTarget: WORKFLOWS_TARGET_VERSION,
    });
    await confirmWith([]);
    expect(mocks.showInformationMessage).toHaveBeenCalledExactlyOnceWith(
      "新しいバージョン 0.2.0 があります。更新しますか？",
      { modal: true },
      UPDATE_ACTION,
    );
  });
});

describe("更新の確認：Guide より新しいプロジェクト", () => {
  const ahead = "99.0.0";
  beforeEach(() => {
    mocks.workspace.workspaceFolders = [{ uri: { fsPath: "/project" } }];
    mocks.gate.mockReturnValue({
      status: "project-newer",
      projectVersion: ahead,
      tools: [{ id: "claude", label: "Claude Code", version: ahead }],
      pin: ahead,
    });
  });

  async function confirmWith(): Promise<unknown> {
    mocks.confirmNewerRelease.mockResolvedValue(undefined);
    await runUpdate();
    const confirm = mocks.confirmNewerRelease.mock.calls[0]?.[1] as (release: {
      version: string;
      notes: string[];
    }) => Promise<boolean>;
    mocks.showInformationMessage.mockResolvedValue(UPDATE_ACTION);
    return confirm({ version: "0.2.0", notes: [] });
  }

  it("says the update opens the project when the new Guide supports its release", async () => {
    mocks.fetchReleaseMetadata.mockResolvedValue({ version: "0.2.0", workflowsTarget: ahead });
    await confirmWith();
    const options = mocks.showInformationMessage.mock.calls[0]?.[1] as { detail?: string };
    expect(options.detail).toBe(`この更新で、プロジェクトの aidlc-workflows ${ahead} に対応します。`);
    expect(options.detail).not.toContain("コミット");
  });

  it("does not promise to open a mixed project that still has an older tool", async () => {
    mocks.gate.mockReturnValue({
      status: "project-newer",
      projectVersion: ahead,
      tools: [
        { id: "claude", label: "Claude Code", version: ahead },
        { id: "cursor", label: "Cursor", version: "98.0.0" },
      ],
      pin: ahead,
    });
    mocks.fetchReleaseMetadata.mockResolvedValue({ version: "0.2.0", workflowsTarget: ahead });
    await confirmWith();
    const options = mocks.showInformationMessage.mock.calls[0]?.[1] as { detail?: string };
    expect(options.detail).not.toContain("に対応します");
    expect(options.detail).toContain(`プロジェクトを ${ahead} にそろえるまで AIDLC Guide を使えません`);
  });

  it("says the update does not open the project when the new Guide supports another release", async () => {
    mocks.fetchReleaseMetadata.mockResolvedValue({ version: "0.2.0", workflowsTarget: "98.0.0" });
    await confirmWith();
    const options = mocks.showInformationMessage.mock.calls[0]?.[1] as { detail?: string };
    expect(options.detail).toContain("この更新の対応版は 98.0.0 です");
    expect(options.detail).toContain("更新後も AIDLC Guide を使えません");
  });

  it("does not claim the project is supported when the metadata is missing", async () => {
    await confirmWith();
    const options = mocks.showInformationMessage.mock.calls[0]?.[1] as { detail?: string };
    expect(options.detail).toContain("更新後の画面で確認できます");
  });

  it("says the latest Guide does not support the project yet, instead of up to date", async () => {
    mocks.confirmNewerRelease.mockImplementation(
      async (_current: string, _confirm: unknown, onNone?: () => Promise<void>) => {
        await onNone?.();
        return undefined;
      },
    );
    mocks.showWarningMessage.mockResolvedValue("更新の案内を開く");
    await runUpdate();
    expect(mocks.showWarningMessage).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(`最新の AIDLC Guide 0.1.0 は、まだ aidlc-workflows ${ahead} に対応していません`),
      "更新の案内を開く",
    );
    expect(mocks.executeCommand).toHaveBeenCalledWith("aidlc-guide.open");
  });

  it("names a preview project as a preview", async () => {
    const preview = "99.0.1-preview.20261020.1";
    mocks.gate.mockReturnValue({
      status: "project-newer",
      projectVersion: preview,
      tools: [{ id: "claude", label: "Claude Code", version: preview }],
      pin: preview,
    });
    // Dismissed: nothing opens.
    mocks.showWarningMessage.mockResolvedValue(undefined);
    mocks.confirmNewerRelease.mockImplementation(
      async (_current: string, _confirm: unknown, onNone?: () => Promise<void>) => {
        await onNone?.();
        return undefined;
      },
    );
    await runUpdate();
    expect(mocks.showWarningMessage.mock.calls[0]?.[0]).toContain(
      `プレビュー版（${preview}）に対応しません`,
    );
    expect(mocks.executeCommand).not.toHaveBeenCalled();
  });

  it("keeps the plain flow for a project the Guide supports, or an untrusted folder", async () => {
    mocks.gate.mockReturnValue({
      status: "ok",
      projectVersion: WORKFLOWS_TARGET_VERSION,
      tools: [],
      pin: null,
    });
    await runUpdate();
    expect(mocks.confirmNewerRelease.mock.calls[0]?.[2]).toBeUndefined();
    mocks.workspace.isTrusted = false;
    mocks.gate.mockClear();
    await runUpdate();
    expect(mocks.gate).not.toHaveBeenCalled();
  });
});
