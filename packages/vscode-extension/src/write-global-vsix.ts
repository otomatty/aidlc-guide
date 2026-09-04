import { tmpdir } from "node:os";
import path from "node:path";
import {
  commands,
  type ExtensionContext,
  extensions,
  ProgressLocation,
  Uri,
  window,
  workspace,
} from "vscode";
import { type ApplyReleaseResult, applyReleaseFromUrl } from "./release-apply.ts";
import { confirmNewerRelease } from "./release-lookup.ts";
import { sideloadVsix } from "./sideload-vsix.ts";
import {
  acceptedChoice,
  applyProgressTitle,
  lookupFailureMessage,
  presentApplyResult,
  UPDATE_ACTION,
} from "./update-feedback.ts";
import { type LatestRelease, vsixDownloadUrl } from "./update-release.ts";

/** Persist a downloaded VSIX under this extension's globalStorage. */
export async function writeGlobalVsix(
  context: ExtensionContext,
  version: string,
  bytes: Uint8Array,
): Promise<string> {
  const root = context.globalStorageUri ?? Uri.file(path.join(tmpdir(), "aidlc-guide-updates"));
  const dir = Uri.joinPath(root, "updates");
  const file = Uri.joinPath(dir, `aidlc-guide-${version}.vsix`);
  await workspace.fs.createDirectory(dir);
  await workspace.fs.writeFile(file, bytes);
  return file.fsPath;
}

export async function deleteGlobalVsix(filePath: string): Promise<void> {
  try {
    await workspace.fs.delete(Uri.file(filePath));
  } catch {
    return;
  }
}

export async function applyLatestRelease(
  context: ExtensionContext,
  release: LatestRelease,
): Promise<ApplyReleaseResult> {
  return applyReleaseFromUrl(release.version, vsixDownloadUrl(release), {
    fetchImpl: fetch,
    writeBytes: (version, bytes) => writeGlobalVsix(context, version, bytes),
    installFromPath: sideloadVsix,
    cleanupPath: deleteGlobalVsix,
  });
}

let registered = false;
let boundContext: ExtensionContext | undefined;
let checkJob: Promise<void> | undefined;

function fallbackHost(): ExtensionContext {
  return {
    globalStorageUri: Uri.file(path.join(tmpdir(), "aidlc-guide-updates")),
    extension: {
      packageJSON: extensions.getExtension("aidlc.aidlc-guide")?.packageJSON ?? {},
    },
  } as ExtensionContext;
}

function runSerializedCheck(context?: ExtensionContext): Promise<void> {
  if (checkJob !== undefined) return checkJob;
  const host = context ?? boundContext;
  checkJob = confirmNewerRelease(
    String(
      host?.extension?.packageJSON?.version ??
        extensions.getExtension("aidlc.aidlc-guide")?.packageJSON.version ??
        "",
    ),
    async (version) => {
      const choice = await window.showInformationMessage(
        `新しいバージョン ${version} があります。更新しますか？`,
        { modal: true },
        UPDATE_ACTION,
      );
      return acceptedChoice(choice, UPDATE_ACTION);
    },
    undefined,
    async (reason) => {
      void window.showErrorMessage(lookupFailureMessage(reason));
    },
  )
    .then(async (release) => {
      if (release === undefined) return;
      const ctx = host ?? fallbackHost();
      const result = await window.withProgress(
        { location: ProgressLocation.Notification, title: applyProgressTitle(release.version) },
        async () => applyLatestRelease(ctx, release),
      );
      await presentApplyResult(result, release.version, {
        showError: (message) => {
          void window.showErrorMessage(message);
        },
        confirmReload: async (message, action) =>
          window.showInformationMessage(message, { modal: true }, action),
        reload: async () => {
          await commands.executeCommand("workbench.action.reloadWindow");
        },
      });
    })
    .finally(() => {
      checkJob = undefined;
    });
  return checkJob;
}

export function registerApplyLatestCommand(context?: ExtensionContext): void {
  if (context !== undefined) boundContext = context;
  if (registered) return;
  registered = true;
  const disposable = commands.registerCommand("aidlc-guide.checkUpdate", () =>
    runSerializedCheck(boundContext),
  );
  context?.subscriptions.push(disposable);
}
