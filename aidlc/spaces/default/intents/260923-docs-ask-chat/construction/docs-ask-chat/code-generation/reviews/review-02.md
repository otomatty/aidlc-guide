## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-09-24T22:59:00Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | packages/vscode-extension/src/dashboard-panel.ts > wireWebview / ready 分岐、および packages/dashboard/src/features/docs/hooks/docs-conversation-bridge.ts | 画面側は `type: "docs-conversation"` で復元を待ち、復元後にだけ保存を送る。ホストの `dashboard-panel.ts` は `loadDocsConversation` / `saveDocsConversation` を import せず、`ready` でも会話を push せず、受信メッセージも扱わない。`docs-conversation.ts` 単体の unit テストはあるが、FR3 / BR3.1 / BR3.3（閉じたあとも同じ会話が残る・ホスト local 保存）の端到端経路は未接続である。`traceability.json` の AC3.* / BR3.* は `docs-conversation.ts` を OK としているが、実装パスは途切れている。 | `dashboard-panel.ts`（または同等の webview 配線）で (1) `ready` 時に `loadDocsConversation` の結果を webview へ postMessage し、(2) 画面からの `docs-conversation` を `saveDocsConversation` へ書く。復元が来ない限り `restoredRef` が立たず永続化されない点も解消する。配線後に往復の契約/UI テストを足し、AC3/BR3 の target を端到端が通るファイルへ直す。 | New |
| R-02 | Major | packages/dashboard/src/features/docs/hooks/qa-wire.ts > receive() の `previous.slice(-19)` | 新規 job 受付時に表示用 turns を直近 19+1 件へ切り詰める。`infrastructure-specification.md` は「件数の上限は置かない」、BR3.2 / FR3.1 / FR4.2 はモデルへ渡す 8 件以外で一覧を切らないとしている。20 件超の会話では古いターンが画面と（配線後は）保存対象から消える。 | `slice(-19)` をやめ、完了ターン一覧は保存された一式を保持する。履歴 8 件の切り詰めは `docsQaAskHistory` のみに閉じる。 | New |
| R-03 | Major | packages/api-core/src/docs-qa/validation.ts > parseQuestion history の `turn.answer.length > 16000` | FR4.1 / BR2.2 / entities Turn.answer（回答は文字数で切らない・上限を付けない）に反し、履歴回答が 16000 字超だと ask 全体が `undefined`（bad-request）になる。画面が全文を送ってもサーバが拒否する。 | 履歴回答の文字数上限チェックを削除する（質問 2000・履歴件数 8 は維持）。契約テストで長文回答履歴が受理されることを固定する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| date -u / shell validation | REJECTED（preToolUse hook） | タイムスタンプはセッション提供時刻 `2026-09-24T22:59:00Z`（user_query の 2026-09-25 07:59 JST）を用いた。構造検証コマンドも同 hook で実行不可。 |
| 手動クロス参照（source-manifest ↔ 実装 ↔ 上流契約） | R-01〜R-03 を確認 | 永続化ヘルパと bridge はあるがホスト配線欠落。`slice(-19)` と answer 16000 上限は契約と矛盾。 |
| stage sensors（linter / type-check / traceability） | 本パスでは未実行 | 構造的な契約違反は手動検証で十分に Critical/Major を支える。 |

### Summary

会話永続化は helper と bridge までで止まり、ホスト webview に未配線のため FR3 系は実装未完了である。あわせて表示 turns の 20 件切り詰めと履歴回答 16000 字拒否が、件数無制限・回答全文の上流契約と衝突する。承認前にホスト配線とこれら二つの契約整合を直すべきである。
