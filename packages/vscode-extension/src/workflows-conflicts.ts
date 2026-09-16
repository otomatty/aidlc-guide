import type { HarnessId } from "./harness-detect.ts";

export type UpdateProblem = {
  harness: HarnessId;
  path: string;
  kind: "ownership" | "legacy-root" | "other";
  detail: string;
  guidance: string;
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Preserve the native failure's structured actions, including on nonzero exit. */
export function configProblems(stdout: string, harness: HarnessId): UpdateProblem[] {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!object(value) || !object(value.data) || !Array.isArray(value.data.actions)) return [];
  return value.data.actions.flatMap((action): UpdateProblem[] => {
    if (
      !object(action) ||
      action.action !== "conflict" ||
      typeof action.path !== "string" ||
      typeof action.detail !== "string"
    )
      return [];
    const kind =
      action.detail === "locally modified or unowned"
        ? "ownership"
        : action.detail.startsWith("legacy root integration ambiguous")
          ? "legacy-root"
          : "other";
    return [
      {
        harness,
        path: action.path,
        kind,
        detail: action.detail,
        guidance:
          kind === "ownership"
            ? "変更されているか、管理記録を確認できません。公式配布物との差分を確認します。"
            : kind === "legacy-root"
              ? "古い AI-DLC 設定の管理範囲を識別できません。独自設定を保持して移行します。"
              : "自動で対処方法を特定できません。詳細を確認してください。",
      },
    ];
  });
}

export class NativeConfigConflict extends Error {
  constructor(readonly problems: UpdateProblem[]) {
    super(`${problems.length} 件の設定競合があります。更新画面の問題一覧を確認してください。`);
  }
}
