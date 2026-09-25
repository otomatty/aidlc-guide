import type { HarnessId } from "./harness-detect.ts";

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
