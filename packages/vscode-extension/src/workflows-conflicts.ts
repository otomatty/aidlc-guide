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
    const guidance =
      kind === "ownership"
        ? "変更されているか、管理記録を確認できません。公式配布物との差分を確認します。"
        : kind === "legacy-root"
          ? "古い AI-DLC 設定の管理範囲を識別できません。AI で修正すると、独自の設定や文章を残したまま古い部分を公式の管理ブロックに置き換えます。"
          : action.detail === "managed block has no ownership baseline"
            ? "公式の管理ブロックはありますが、所有記録がありません。ツールごとに公式の内容が違うため、除外ルールを一つにまとめて付け直します。"
            : "自動で対処方法を特定できません。詳細を確認してください。";
    return [{ harness, path: action.path, kind, detail: action.detail, guidance }];
  });
}

export class NativeConfigConflict extends Error {
  /** Carry structured diagnostics through native command failures to the update panel. */
  constructor(readonly problems: UpdateProblem[]) {
    super(`${problems.length} 件の設定競合があります。更新画面の問題一覧を確認してください。`);
  }
}
