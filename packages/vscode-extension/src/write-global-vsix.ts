import { commands, type ExtensionContext, Uri, window, workspace } from "vscode";
import { applyReleaseFromUrl } from "./release-apply.ts";
import { confirmNewerRelease } from "./release-lookup.ts";
import { sideloadVsix } from "./sideload-vsix.ts";
import { type LatestRelease, vsixDownloadUrl } from "./update-release.ts";

/** Persist a downloaded VSIX under this extension's globalStorage. */
export async function writeGlobalVsix(
  context: ExtensionContext,
  version: string,
  bytes: Uint8Array,
): Promise<string> {
  const dir = Uri.joinPath(context.globalStorageUri, "updates");
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
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return applyReleaseFromUrl(release.version, vsixDownloadUrl(release), {
    fetchImpl: fetch,
    writeBytes: (version, bytes) => writeGlobalVsix(context, version, bytes),
    installFromPath: sideloadVsix,
    cleanupPath: deleteGlobalVsix,
  });
}

let registered = false;

export function registerApplyLatestCommand(context: ExtensionContext): void {
  if (registered) return;
  registered = true;
  context.subscriptions.push(
    commands.registerCommand("aidlc-guide.checkUpdate", () => {
      void confirmNewerRelease(
        String(context.extension.packageJSON.version ?? ""),
        async (version) => {
          const choice = await window.showInformationMessage(
            `新しいバージョン ${version} があります。更新しますか？`,
            "更新する",
          );
          return choice === "更新する";
        },
      ).then((release) => {
        if (release !== undefined) void applyLatestRelease(context, release);
      });
    }),
  );
}
