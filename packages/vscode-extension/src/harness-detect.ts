import { existsSync } from "node:fs";
import path from "node:path";

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
  for (const id of DETECT_ORDER) {
    const detector = DETECTORS[id];
    if (!detector(workspaceRoot)) continue;
    harnesses.push({ id, label: HARNESS_LABELS[id] });
  }
  const ids = new Set(harnesses.map((h) => h.id));
  return {
    harnesses,
    aidlcDirCollision: ids.has("copilot") && ids.has("opencode"),
  };
}
