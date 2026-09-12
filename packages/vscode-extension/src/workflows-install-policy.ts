import type { HarnessId } from "./harness-detect.ts";

// No verified native release supports adding another harness to a project yet.
// Widen this policy only alongside native integration tests for that release.
export const MAX_INSTALL_HARNESSES = 1;
export const UNSUPPORTED_HARNESS_INSTALL_MESSAGE =
  "現在対応している AI-DLC 本体では、複数ツールの一括設定と、設定済みプロジェクトへの別ツールの追加はできません。新規プロジェクトではツールを1つ選択してください。";

/** Reject unsupported selections before any runtime or project writes. */
export function harnessInstallBlockReason(
  selected: readonly HarnessId[],
  detected: readonly HarnessId[],
): "multi-harness-unsupported" | "harness-addition-unsupported" | null {
  if (selected.length > MAX_INSTALL_HARNESSES) return "multi-harness-unsupported";
  if (detected.length > 0 && selected.some((id) => !detected.includes(id)))
    return "harness-addition-unsupported";
  return null;
}
