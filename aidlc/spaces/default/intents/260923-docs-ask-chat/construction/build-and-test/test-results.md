# テスト結果

`bun run check` はフォーマット検査で止まった。境界の Vitest は、その前に別コマンドで通っている。

## ビルド

失敗。`bun run format:check` が終了コード 1。

対象は次の 3 ファイル。

- `packages/dashboard/src/features/docs/docs-question-panel-impl.tsx`
- `packages/dashboard/src/features/docs/docs-shell-chat.tsx`
- `packages/dashboard/src/features/docs/hooks/useDocsQa.ts`

lint はその前に通った。型検査、カバレッジ、`bun audit` には到達していない。

## テスト

| コマンド | 結果 |
| --- | --- |
| 境界の Vitest 5 ファイル | 70 件成功 |
| `packages/vscode-extension/src/docs-conversation.test.ts` | 6 件成功 |
| `bun run check` | フォーマットで失敗。テスト本体は未実行 |

失敗の詳細はアサーションではない。oxfmt が上記 3 ファイルを未整形と判定した。

## カバレッジ

`test:coverage` は未実行。行 80%、分岐 70%、既存 95% はまだ測れていない。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| NFR1.1 | observability-requirements.md | UI テストが `bun run check` に含まれる | check がフォーマットで停止 | この実行の format:check | build-and-test | Unverified |
| NFR1.2 | observability-requirements.md | 契約テストが `bun run check` に含まれる | check がフォーマットで停止 | この実行の format:check | build-and-test | Unverified |
| NFR1.3 | observability-requirements.md | テストを先に失敗させ、それから実装する | コード生成の記録ではその順で進んだ。この実行では再確認していない | code-summary.md | code-generation | Unverified |
| NFR2.1 | performance-requirements.md | docs-qa 分岐 70% 以上 | 未測定 | test:coverage 未到達 | build-and-test | Unverified |
| NFR2.2 | performance-requirements.md | 既存分岐 95% を維持 | 未測定 | test:coverage 未到達 | build-and-test | Unverified |
| NFR2.3 | performance-requirements.md | 行カバレッジ 80% | 未測定 | test:coverage 未到達 | build-and-test | Unverified |
| NFR3.1-reliability | reliability-requirements.md | 閉じたあとターンと書きかけが残る | 6 件成功 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.1-security | security-requirements.md | ワークスペースのファイルに会話を書かない | 6 件成功 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.2 | security-requirements.md | 保存をクラウドへ送らない | 契約テストはローカルの偽コンテキストのみ | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-reliability | reliability-requirements.md | 進行中は 1 件 | 70 件成功のうち、進行中の送信拒否を含む | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-scalability | scalability-requirements.md | 2 件目は拒否する | 同じ契約テスト | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR5.1 | security-requirements.md | ホストモードは送信、取得、キャンセル、根拠取得を拒否する | 契約テストが成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |

品質ゲート自体は Not Met ではない。ゲートは未完了であり、上の Unverified がこのステージの失敗である。

## 準備状況

ビルド手順は書いた。品質ゲートはフォーマットまでで、テスト準備は境界の Vitest だけが済んでいる。

## Loop-Back Log

### Loop-back 1 — 2026-09-24T22:47:40Z

- Diagnosis: `bun run format:check` が終了コード 1。未整形は `packages/dashboard/src/features/docs/docs-question-panel-impl.tsx`、`packages/dashboard/src/features/docs/docs-shell-chat.tsx`、`packages/dashboard/src/features/docs/hooks/useDocsQa.ts`。ビルド手順やテスト足場ではなく、コード生成が書いたソース。
- Root-cause stage: code-generation
- Planned fix: 上の 3 ファイルを oxfmt で整形し、`bun run check` をやり直す。
- Estimated impact: effort: minutes; financial cost: none; risk: format-only
