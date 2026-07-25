import type { Bridge } from "@aidlc-guide/docs-bridge";
import type { DeepLink, StageDoc } from "@aidlc-guide/shared-types";
import { renderResult, type ToolReply } from "../render.ts";

export const EXPLAIN_STAGE_DESCRIPTION =
  "AI-DLC の特定ステージが何をする段階か（目的 / 入出力 / 担当エージェント / 承認ゲートで求められること）を" +
  "知りたいときに使う。ユーザーが「このステージって何？」と聞いたとき、または未知の slug を見たときに呼ぶ。" +
  "slug は aidlc_status が返すステージ名。";

export function formatDeepLink(link: DeepLink | null): string {
  return link === null ? "（リンクなし）" : `${link.docPath}#${link.docAnchor}`;
}

/**
 * Verbatim only (BR-MS-4). The excerpt is docs-bridge's own section slice and
 * the five fields are static entries — this server does not paraphrase,
 * summarise or re-order them, because a re-worded AI-DLC definition read back
 * as authoritative is exactly the failure this project exists to prevent.
 */
function describe(doc: StageDoc): string {
  const lines = [
    `ステージ: ${doc.slug}`,
    `目的: ${doc.purpose}`,
    `入力: ${doc.inputs.length === 0 ? "（なし）" : doc.inputs.join(", ")}`,
    `出力: ${doc.outputs.length === 0 ? "（なし）" : doc.outputs.join(", ")}`,
    `担当エージェント: ${doc.agent}`,
    `承認ゲートで求められること: ${doc.gateRequirement}`,
    `ドキュメント: ${formatDeepLink(doc.deepLink)}`,
    `（出典バージョン: ${doc.sourceVersion}）`,
  ];
  if (doc.excerpt !== null) lines.push("", "--- ドキュメント本文（原文のまま） ---", doc.excerpt);
  return lines.join("\n");
}

/** M2 (FR-2.2 / US-03). An unknown slug is `not-found` → an ordinary reply. */
export async function explainStage(
  bridge: Bridge,
  workspaceRoot: string,
  slug: string,
): Promise<ToolReply> {
  return renderResult(await bridge.resolveStage(slug), workspaceRoot, describe);
}
