import { existsSync } from "node:fs";
import path from "node:path";
import { type ExtensionContext, workspace } from "vscode";
import { CODEX_GIT_REQUIRED, isGitRepository } from "./git-prerequisite.ts";
import { detectHarnesses, type HarnessId } from "./harness-detect.ts";
import { docsSkillPath, mcpScriptPath, refreshDocsRegistration } from "./mcp-register.ts";
import { readNativeProjections } from "./native-projection.ts";
import { type NativeInstall, readNativeInstall } from "./native-setup.ts";
import { readWorkspaceAidlcVersion } from "./workflows-version.ts";

export type SetupPreference = { completed: boolean; docsSkipped: boolean; harness: HarnessId };
export type SetupSnapshot = {
  root: string;
  configured: boolean;
  projectPresent: boolean;
  native: NativeInstall | null;
  version: string | null;
  harnesses: HarnessId[];
  docsReady: boolean;
  docsReason?: string;
  runtimeIssue?: string;
  preference: SetupPreference | undefined;
};

export const setupStateKey = (root: string): string => `aidlc-guide.setup.v2:${root}`;

/** Setup completion does not require an Intent. Startup only reads files. */
export async function inspectSetup(
  context: ExtensionContext,
  root: string,
): Promise<SetupSnapshot> {
  const harnesses = detectHarnesses(root).harnesses.map((h) => h.id);
  const projectPresent = existsSync(path.join(root, "aidlc", "spaces")) && harnesses.length > 0;
  const native = readNativeInstall(root);
  const projections = readNativeProjections(root);
  const version = readWorkspaceAidlcVersion(root).version;
  const nativeVersions = new Set(projections.map((projection) => projection.version));
  const runtimeIssue =
    harnesses.includes("codex") && (!workspace.isTrusted || !(await isGitRepository(root)))
      ? CODEX_GIT_REQUIRED
      : nativeVersions.size > 1
        ? `ツール別の設定に異なるバージョン（${[...nativeVersions].join("、")}）があります。公式の手順で各ツールの設定を同じ版に揃えてください。`
        : projections.length > 0 && projections[0]?.version !== native?.version
          ? `プロジェクトの版 ${projections[0]?.version} に対応する本体を利用できません。本体の導入後、プロジェクトのフォルダで aidlc use ${projections[0]?.version} を実行してください。.aidlc-version がある場合は、その内容がプロジェクトの版と一致することを確認し、aidlc config --pin ${projections[0]?.version} で固定版の登録を修復してください。`
          : undefined;
  const docs = await refreshDocsRegistration(
    root,
    mcpScriptPath(context.extensionPath),
    docsSkillPath(context.extensionPath),
    false,
  );
  return {
    root,
    projectPresent,
    native,
    version,
    harnesses,
    configured: projectPresent && version !== null && runtimeIssue === undefined,
    runtimeIssue,
    docsReady: docs.complete,
    docsReason: docs.reason,
    preference: context.workspaceState.get<SetupPreference>(setupStateKey(root)),
  };
}

export function needsSetup(snapshot: SetupSnapshot): boolean {
  return (
    !snapshot.configured ||
    !(snapshot.docsReady || (snapshot.preference?.completed && snapshot.preference.docsSkipped))
  );
}
