import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Which aidlc-workflows harness trees a workspace carries, and the version
 * each one records. Shared by the VS Code extension, the browser dashboard,
 * and the MCP server so every surface applies the same version check.
 */

export type HarnessId =
  | "cursor"
  | "claude"
  | "copilot"
  | "codex"
  | "kiro"
  | "kiro-ide"
  | "opencode";

export type DetectedHarness = {
  id: HarnessId;
  label: string;
};

export type HarnessDetectResult = {
  harnesses: DetectedHarness[];
  aidlcDirCollision: boolean;
};

export const HARNESS_LABELS: Record<HarnessId, string> = {
  cursor: "Cursor",
  claude: "Claude Code",
  copilot: "GitHub Copilot",
  codex: "Codex",
  kiro: "Kiro CLI",
  "kiro-ide": "Kiro IDE",
  opencode: "opencode",
};

const STRICT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const PROJECTIONS = {
  ".claude": ["claude"],
  ".cursor": ["cursor"],
  ".codex": ["codex"],
  ".kiro": ["kiro", "kiro-ide"],
  ".aidlc": ["copilot", "opencode"],
} as const;

export type NativeProjection = {
  harness: string;
  version: string;
  sourcePath: string;
  raw: string;
};

/** Native installs stamp each harness tree with the release that wrote it. */
function readStamp(sourcePath: string, allowed: readonly string[]): NativeProjection | null {
  try {
    const raw = readFileSync(sourcePath, "utf8");
    const stamp = JSON.parse(raw);
    if (stamp?.schemaVersion !== 1 || !allowed.includes(stamp.distribution)) return null;
    const version =
      typeof stamp.frameworkVersion === "string" && STRICT_VERSION.test(stamp.frameworkVersion)
        ? stamp.frameworkVersion
        : null;
    return version === null
      ? null
      : { harness: stamp.distribution as string, version, sourcePath, raw };
  } catch {
    return null;
  }
}

export function readNativeProjections(root: string): NativeProjection[] {
  const found: NativeProjection[] = [];
  for (const [dir, allowed] of Object.entries(PROJECTIONS)) {
    const sourcePath = path.join(root, dir, "tools", "data", "aidlc-stamp.json");
    if (!existsSync(sourcePath)) continue;
    // A partial or invalid stamp is not proof of a configured installation.
    const stamp = readStamp(sourcePath, allowed);
    if (stamp) found.push(stamp);
  }
  return found;
}

/** Stamps that exist but cannot be read: a half-written release the gate must not pass. */
export function unreadableNativeStamps(root: string): string[] {
  return Object.entries(PROJECTIONS).flatMap(([dir, allowed]) => {
    const sourcePath = path.join(root, dir, "tools", "data", "aidlc-stamp.json");
    return existsSync(sourcePath) && readStamp(sourcePath, allowed) === null ? [sourcePath] : [];
  });
}

const DETECT_ORDER: HarnessId[] = [
  "cursor",
  "claude",
  "copilot",
  "codex",
  "kiro",
  "kiro-ide",
  "opencode",
];

function present(root: string, ...parts: string[]): boolean {
  return existsSync(path.join(root, ...parts));
}

function isCursor(root: string): boolean {
  return (
    present(root, ".cursor", "skills", "aidlc") || present(root, ".cursor", "aidlc-install.json")
  );
}

function isClaude(root: string): boolean {
  return present(root, ".claude", "skills", "aidlc");
}

function isCopilot(root: string): boolean {
  if (present(root, ".github", "skills", "aidlc")) return true;
  return (
    present(root, ".aidlc", "tools", "aidlc-version.ts") &&
    (present(root, ".github", "hooks", "aidlc.json") ||
      present(root, ".github", "agents", "aidlc-product-agent.md"))
  );
}

function isCodex(root: string): boolean {
  return present(root, ".codex", "tools", "aidlc-version.ts");
}

function isKiroIde(root: string): boolean {
  return present(root, ".kiro", "steering", "aidlc-active-memory.md");
}

function isKiroCli(root: string): boolean {
  return !isKiroIde(root) && present(root, ".kiro", "skills", "aidlc");
}

function isOpencode(root: string): boolean {
  return (
    present(root, ".opencode", "command", "aidlc.md") ||
    present(root, ".opencode", "plugin", "aidlc-opencode-adapter.ts")
  );
}

const DETECTORS: Record<HarnessId, (root: string) => boolean> = {
  cursor: isCursor,
  claude: isClaude,
  copilot: isCopilot,
  codex: isCodex,
  kiro: isKiroCli,
  "kiro-ide": isKiroIde,
  opencode: isOpencode,
};

export function detectHarnesses(workspaceRoot: string): HarnessDetectResult {
  const harnesses: DetectedHarness[] = [];
  const native = new Set(readNativeProjections(workspaceRoot).map((p) => p.harness));
  for (const id of DETECT_ORDER) {
    const detector = DETECTORS[id];
    if (!native.has(id) && !detector(workspaceRoot)) continue;
    harnesses.push({ id, label: HARNESS_LABELS[id] });
  }
  const ids = new Set(harnesses.map((h) => h.id));
  return {
    harnesses,
    aidlcDirCollision: ids.has("copilot") && ids.has("opencode"),
  };
}

export type HarnessConflict = {
  ids: readonly HarnessId[];
  message: string;
};

/** Shared by the setup webview and the install/update entry points. */
export const HARNESS_CONFLICTS = [
  {
    ids: ["copilot", "opencode"],
    message: "GitHub Copilot と opencode は同じ .aidlc/ を使うため、同時に設定できません。",
  },
  {
    ids: ["kiro", "kiro-ide"],
    message: "Kiro CLI と Kiro IDE は同じ .kiro/ を使うため、同時に設定できません。",
  },
  ...(["kiro", "kiro-ide", "codex", "cursor"] as const).map((id) => ({
    ids: ["copilot", id] as const,
    message: `GitHub Copilot と ${id} は AGENTS.md の管理ブロックが異なるため、同時に設定できません。`,
  })),
] as const satisfies readonly HarnessConflict[];

export function findHarnessConflict(ids: readonly HarnessId[]): HarnessConflict | undefined {
  return HARNESS_CONFLICTS.find((conflict) => conflict.ids.every((id) => ids.includes(id)));
}

export function harnessVersionRel(id: HarnessId): string {
  switch (id) {
    case "cursor":
      return path.join(".cursor", "tools", "aidlc-version.ts");
    case "claude":
      return path.join(".claude", "tools", "aidlc-version.ts");
    case "copilot":
    case "opencode":
      return path.join(".aidlc", "tools", "aidlc-version.ts");
    case "codex":
      return path.join(".codex", "tools", "aidlc-version.ts");
    case "kiro":
    case "kiro-ide":
      return path.join(".kiro", "tools", "aidlc-version.ts");
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

const VERSION_FILE_REL = [
  harnessVersionRel("cursor"),
  harnessVersionRel("claude"),
  harnessVersionRel("copilot"),
  harnessVersionRel("codex"),
  harnessVersionRel("kiro"),
] as const;

const VERSION_CONST_RE = /export\s+const\s+AIDLC_VERSION\s*=\s*(["'])([^"']+)\1/;
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export type WorkspaceAidlcVersion = {
  version: string | null;
  sourcePath: string | null;
  raw: string | null;
};

export function parseAidlcVersionSource(source: string): string | null {
  const match = VERSION_CONST_RE.exec(source);
  if (match === null || match[2] === undefined) return null;
  const value = match[2];
  // Matches the extension's parseSemver, which accepts a leading v.
  return SEMVER_RE.test(value.replace(/^[vV]/, "")) ? value : null;
}

/** Every recorded version: native stamps first, then copy-channel version files. */
export function readAllWorkspaceAidlcVersions(workspaceRoot: string): WorkspaceAidlcVersion[] {
  const projections = readNativeProjections(workspaceRoot);
  const found: WorkspaceAidlcVersion[] = projections.map(({ version, sourcePath, raw }) => ({
    version,
    sourcePath,
    raw,
  }));
  const nativeDirs = new Set(projections.map((p) => path.dirname(path.dirname(p.sourcePath))));
  const seen = new Set<string>();
  for (const rel of VERSION_FILE_REL) {
    const file = path.join(workspaceRoot, rel);
    if (nativeDirs.has(path.dirname(file))) continue;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      // Present but unreadable (a directory, no permission) counts like an
      // unparseable file, so no caller mistakes it for a missing one.
      found.push({ version: null, sourcePath: file, raw: null });
      continue;
    }
    found.push({
      version: parseAidlcVersionSource(raw),
      sourcePath: file,
      raw,
    });
  }
  return found;
}
