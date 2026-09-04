import type { ApplyReleaseResult } from "./release-apply.ts";

export const UPDATE_ACTION = "更新する";
export const RELOAD_ACTION = "再読み込み";

export type UpdateFeedbackUi = {
  showError: (message: string) => void | Promise<void>;
  confirmReload: (message: string, action: string) => Promise<unknown>;
  reload: () => Promise<void>;
};

export function acceptedChoice(choice: unknown, action: string): boolean {
  if (choice === action) return true;
  if (typeof choice === "object" && choice !== null && "title" in choice) {
    return (choice as { title: unknown }).title === action;
  }
  return false;
}

function failureLabel(reason: Exclude<ApplyReleaseResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "timeout":
      return "ダウンロードが時間切れ";
    case "network":
      return "ネットワークエラー";
    case "http":
      return "ダウンロード失敗";
    case "invalid-vsix":
      return "ファイルが VSIX ではありません";
    case "write":
      return "保存に失敗";
    case "install":
      return "インストールに失敗";
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

export function applyFailureMessage(result: Exclude<ApplyReleaseResult, { ok: true }>): string {
  const head = `更新に失敗しました（${failureLabel(result.reason)}）`;
  const body = result.detail !== undefined && result.detail !== "" ? `：${result.detail}` : "。";
  const kept =
    result.reason === "install" && result.filePath
      ? ` ファイルを残してあります: ${result.filePath}。「Extensions: Install from VSIX」から手動で入れられます。`
      : "";
  return `${head}${body}${kept}`;
}

export function applySuccessMessage(version: string): string {
  return `バージョン ${version} をインストールしました。反映するにはウィンドウを再読み込みしてください。`;
}

export function applyProgressTitle(version: string): string {
  return `AIDLC Guide ${version} を更新しています…`;
}

export async function presentApplyResult(
  result: ApplyReleaseResult,
  version: string,
  ui: UpdateFeedbackUi,
): Promise<void> {
  if (!result.ok) {
    await ui.showError(applyFailureMessage(result));
    return;
  }
  const choice = await ui.confirmReload(applySuccessMessage(version), RELOAD_ACTION);
  if (acceptedChoice(choice, RELOAD_ACTION)) await ui.reload();
}

export function lookupFailureMessage(reason: string): string {
  switch (reason) {
    case "rate-limited":
      return "更新の確認に失敗しました（GitHub の要求回数制限に達しました）。";
    case "timeout":
      return "更新の確認に失敗しました（タイムアウト）。";
    case "network":
      return "更新の確認に失敗しました（ネットワークエラー）。";
    case "http":
      return "更新の確認に失敗しました（リリース情報を取得できません）。";
    case "missing-asset":
      return "更新の確認に失敗しました（VSIX がリリースにありません）。";
    case "parse":
      return "更新の確認に失敗しました（リリース情報を解釈できません）。";
    default:
      return `更新の確認に失敗しました（${reason}）。`;
  }
}
