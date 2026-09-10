import { existsSync } from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "vscode";
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
  const native = readNativeInstall();
  const projections = readNativeProjections(root);
  const version = readWorkspaceAidlcVersion(root).version;
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
    configured: projectPresent && version !== null && (projections.length === 0 || native !== null),
    docsReady: docs.complete,
    docsReason: docs.reason,
    preference: context.workspaceState.get<SetupPreference>(setupStateKey(root)),
  };
}

export function needsSetup(snapshot: SetupSnapshot): boolean {
  return !snapshot.configured || !(snapshot.preference?.completed || snapshot.docsReady);
}
