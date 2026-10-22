import { tmpdir } from "node:os";
import path from "node:path";
import { inspectVersionGate, isPreviewRelease } from "@aidlc-guide/reader-core";
import { WORKFLOWS_TARGET_VERSION } from "@aidlc-guide/shared-types";
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
import { confirmNewerRelease, fetchReleaseMetadata } from "./release-lookup.ts";
import { sideloadVsix } from "./sideload-vsix.ts";
import {
  acceptedChoice,
  applyProgressTitle,
  lookupFailureMessage,
  OPEN_GATE_ACTION,
  presentApplyResult,
  projectUnsupportedNotice,
  UPDATE_ACTION,
  updateConfirmDetail,
} from "./update-feedback.ts";
import { type LatestRelease, releaseWorkflowsChange, vsixDownloadUrl } from "./update-release.ts";

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

/**
 * A project ahead of this Guide, for the version check's first folder
 * (docs/maintenance/version-gate-design.md): the newest release it records,
 * which a Guide must support, and every release it records, which must all
 * match for that Guide to open it. Null when the project is not ahead.
 */
function projectAhead(): { version: string; recorded: string[] } | null {
  const root = workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (root === undefined || !workspace.isTrusted) return null;
  try {
    const gate = inspectVersionGate(root, WORKFLOWS_TARGET_VERSION);
    if (gate.status !== "project-newer" || gate.projectVersion === null) return null;
    const recorded = [...gate.tools.map((tool) => tool.version), gate.pin].filter(
      (version): version is string => version !== null,
    );
    return { version: gate.projectVersion, recorded };
  } catch {
    return null;
  }
}

function runSerializedCheck(context?: ExtensionContext): Promise<void> {
  if (checkJob !== undefined) return checkJob;
  const host = context ?? boundContext;
  const current = String(
    host?.extension?.packageJSON?.version ??
      extensions.getExtension("aidlc.aidlc-guide")?.packageJSON.version ??
      "",
  );
  const ahead = projectAhead();
  checkJob = confirmNewerRelease(
    current,
    async (release) => {
      // A Guide that supports another aidlc-workflows release blocks this project until it is updated.
      const metadata = await fetchReleaseMetadata(release);
      const change = releaseWorkflowsChange(WORKFLOWS_TARGET_VERSION, metadata);
      const supports = (target: string) =>
        ahead === null || target !== ahead.version
          ? false
          : ahead.recorded.every((version) => version === target) || ("partial" as const);
      const project =
        ahead === null
          ? null
          : {
              version: ahead.version,
              supported:
                typeof metadata === "object"
                  ? supports(metadata.workflowsTarget)
                  : ("unverified" as const),
            };
      const detail = updateConfirmDetail(release.version, release.notes, change, project);
      const choice = await window.showInformationMessage(
        `新しいバージョン ${release.version} があります。更新しますか？`,
        detail === undefined ? { modal: true } : { modal: true, detail },
        UPDATE_ACTION,
      );
      return acceptedChoice(choice, UPDATE_ACTION);
    },
    // "Up to date" would read as a fix for a project this Guide cannot open yet.
    ahead === null
      ? undefined
      : async () => {
          const choice = await window.showWarningMessage(
            projectUnsupportedNotice(
              current,
              ahead.version,
              WORKFLOWS_TARGET_VERSION,
              isPreviewRelease(ahead.version),
            ),
            OPEN_GATE_ACTION,
          );
          if (choice === OPEN_GATE_ACTION) await commands.executeCommand("aidlc-guide.open");
        },
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
        confirmReload: async (message, action) => window.showInformationMessage(message, action),
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
