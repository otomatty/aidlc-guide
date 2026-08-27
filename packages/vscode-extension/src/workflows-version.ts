import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { compareSemver, parseSemver } from "./update-release.ts";

const VERSION_FILE_REL = [
  path.join(".cursor", "tools", "aidlc-version.ts"),
  path.join(".claude", "tools", "aidlc-version.ts"),
  path.join(".aidlc", "tools", "aidlc-version.ts"),
  path.join(".codex", "tools", "aidlc-version.ts"),
  path.join(".kiro", "tools", "aidlc-version.ts"),
] as const;

const VERSION_CONST_RE = /export\s+const\s+AIDLC_VERSION\s*=\s*(["'])([^"']+)\1/;

export const WORKFLOWS_SNOOZE_KEY = "aidlc-guide.workflowsUpdateSnoozed";
export const UPDATE_WORKFLOWS_COMMAND = "aidlc-guide.updateWorkflows";
export const OFFICIAL_DOCS_MANIFEST_REL = path.join("docs", "official-docs.manifest.json");

export type WorkflowsVersionStatus =
  | { kind: "older"; workspace: string; pin: string }
  | { kind: "current-or-newer"; workspace: string; pin: string }
  | { kind: "unparseable"; raw: string | null; pin: string | null }
  | { kind: "missing"; pin: string };

export type WorkspaceAidlcVersion = {
  version: string | null;
  sourcePath: string | null;
  raw: string | null;
};

export function parseAidlcVersionSource(source: string): string | null {
  const match = VERSION_CONST_RE.exec(source);
  if (match === null || match[2] === undefined) return null;
  const value = match[2];
  return parseSemver(value) === null ? null : value;
}

export function parsePinnedManifest(json: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const sourceVersion = (parsed as Record<string, unknown>).sourceVersion;
  if (typeof sourceVersion !== "string" || sourceVersion.trim() === "") return null;
  const trimmed = sourceVersion.trim();
  return parseSemver(trimmed) === null ? null : trimmed;
}

export function readPinnedVersion(docsRoot: string): string | null {
  const file = path.join(docsRoot, OFFICIAL_DOCS_MANIFEST_REL);
  if (!existsSync(file)) return null;
  try {
    return parsePinnedManifest(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function readWorkspaceAidlcVersion(workspaceRoot: string): WorkspaceAidlcVersion {
  for (const rel of VERSION_FILE_REL) {
    const file = path.join(workspaceRoot, rel);
    if (!existsSync(file)) continue;
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    return {
      version: parseAidlcVersionSource(raw),
      sourcePath: file,
      raw,
    };
  }
  return { version: null, sourcePath: null, raw: null };
}

export function compareWorkflowsVersion(
  workspace: string | null,
  pin: string | null,
): WorkflowsVersionStatus {
  if (pin === null || parseSemver(pin) === null) {
    return { kind: "unparseable", raw: workspace, pin };
  }
  if (workspace === null) {
    return { kind: "missing", pin };
  }
  const workspaceSemver = parseSemver(workspace);
  const pinSemver = parseSemver(pin);
  if (workspaceSemver === null || pinSemver === null) {
    return { kind: "unparseable", raw: workspace, pin };
  }
  if (compareSemver(workspaceSemver, pinSemver) < 0) {
    return { kind: "older", workspace, pin };
  }
  return { kind: "current-or-newer", workspace, pin };
}

export function shouldPromptWorkflowsUpdate(
  status: WorkflowsVersionStatus,
  snoozed: boolean,
): boolean {
  return status.kind === "older" && !snoozed;
}

export function resolveWorkflowsStatus(
  workspaceRoot: string,
  docsRoot: string,
): WorkflowsVersionStatus {
  const pin = readPinnedVersion(docsRoot);
  const workspace = readWorkspaceAidlcVersion(workspaceRoot);
  if (workspace.sourcePath !== null && workspace.version === null) {
    return { kind: "unparseable", raw: workspace.raw, pin };
  }
  return compareWorkflowsVersion(workspace.version, pin);
}
