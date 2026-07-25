import type { Bridge } from "@aidlc-guide/docs-bridge";
import type { TermDoc } from "@aidlc-guide/shared-types";
import { renderResult, type ToolReply } from "../render.ts";
import { formatDeepLink } from "./explain-stage.ts";

export const GLOSSARY_DESCRIPTION =
  "AI-DLC 用語（Bolt / Unit of Work / ゲート / スコープ など）の定義を引きたいときに使う。" +
  "ユーザーが用語の意味を尋ねたとき、または自分が用語を説明する前に、記憶ではなくこれで定義を確認する。";

/** Verbatim, like explain_stage — no rewording of a definition (BR-MS-4). */
function describe(doc: TermDoc): string {
  const lines = [
    `用語: ${doc.term}`,
    `定義: ${doc.definition}`,
    `ドキュメント: ${formatDeepLink(doc.deepLink)}`,
    `（出典バージョン: ${doc.sourceVersion}）`,
  ];
  if (doc.excerpt !== null) lines.push("", "--- ドキュメント本文（原文のまま） ---", doc.excerpt);
  return lines.join("\n");
}

/** M5 (FR-2.5 / US-04). An unknown term is `undefined-term` → an ordinary reply. */
export async function glossary(
  bridge: Bridge,
  workspaceRoot: string,
  term: string,
): Promise<ToolReply> {
  return renderResult(await bridge.resolveTerm(term), workspaceRoot, describe);
}
