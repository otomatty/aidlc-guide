# テスト結果

`bun run check` は終了コード 0。テストは 3596 件成功、7 件スキップ。脆弱性は 0 件。

## ビルド

成功。lint、フォーマット、型検査、文書索引、互換性、カバレッジ付きテスト、監査シャード、`bun audit` まで到達した。

前回止まっていた 3 ファイルは整形済みで、`oxfmt --check` は 494 ファイルすべてを正しい形式と判定した。

## テスト

| コマンド | 結果 |
| --- | --- |
| `bun run check` | 終了コード 0。213 ファイル、3596 件成功、7 件スキップ |
| 境界の Vitest（`check` に含まれる） | 同じ実行の中で成功 |
| `packages/vscode-extension/src/docs-conversation.test.ts` | 同じ実行の中で成功 |

失敗したアサーションはない。

## カバレッジ

| 指標 | 実測 |
| --- | --- |
| 行 | 88.96%（11627/13069） |
| 分岐 | 81.68%（10952/13407） |
| 文 | 86.43%（12904/14930） |
| 関数 | 86.95%（2553/2936） |

`vitest.config.ts` の閾値は、行 80%、`packages/api-core/src/handlers/docs-qa.ts` の分岐 70%、`reader-core` の parse と `official-docs` の resolve / roots / markdown の 95% である。未達なら `bun run check` は 0 で終わらない。この実行は 0 で終わった。保持した要約に `docs-qa.ts` だけの百分率は残っていない。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| NFR1.1 | observability-requirements.md | UI テストが `bun run check` に含まれる | 213 ファイルが成功。画面テストはゲートの中で実行された | `bun run check` 終了コード 0 | build-and-test | Met |
| NFR1.2 | observability-requirements.md | 契約テストが `bun run check` に含まれる | 契約テストは同じゲートの中で実行された | `bun run check` 終了コード 0 | build-and-test | Met |
| NFR1.3 | observability-requirements.md | テストを先に失敗させ、それから実装する | 計画の Red 手順 Step 2、5、8、11 は完了済み。この実行では失敗の再演はしていない | code-generation-plan.md | code-generation | Met |
| NFR2.1 | performance-requirements.md | docs-qa 分岐 70% 以上 | 閾値 70% を通過。全体の分岐は 81.68% | `bun run check` のカバレッジ | build-and-test | Met |
| NFR2.2 | performance-requirements.md | 既存分岐 95% を維持 | parse と official-docs の 95% 閾値を通過 | `bun run check` のカバレッジ | build-and-test | Met |
| NFR2.3 | performance-requirements.md | 行カバレッジ 80% | 行 88.96% | `bun run check` のカバレッジ | build-and-test | Met |
| NFR3.1-reliability | reliability-requirements.md | 閉じたあとターンと書きかけが残る | 保存の往復テストがゲートの中で成功 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.1-security | security-requirements.md | ワークスペースのファイルに会話を書かない | 同じ保存テストが成功。`bun audit` は脆弱性 0 件 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.2 | security-requirements.md | 保存をクラウドへ送らない | 契約テストはローカルの偽コンテキストのみ。クラウド通信はない | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-reliability | reliability-requirements.md | 進行中は 1 件 | 契約テストが成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-scalability | scalability-requirements.md | 2 件目は拒否する | 同じ契約テスト | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR5.1 | security-requirements.md | ホストモードは送信、取得、キャンセル、根拠取得を拒否する | 契約テストが成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |

## 準備状況

ビルドもテストも通った。測定した目標はすべて Met。配置の準備は、この変更がローカル専用のため対象外である。

横断の対応では、受入条件 19 件は単位の traceability で OK かつ対象ファイルが存在する。要件本文の FR と NFR の親 ID は、その表に ID として載っていない。

## Loop-Back Log

### Loop-back 1 — 2026-09-24T22:47:40Z

- Diagnosis: `bun run format:check` が終了コード 1。未整形は `packages/dashboard/src/features/docs/docs-question-panel-impl.tsx`、`packages/dashboard/src/features/docs/docs-shell-chat.tsx`、`packages/dashboard/src/features/docs/hooks/useDocsQa.ts`。ビルド手順やテスト足場ではなく、コード生成が書いたソース。
- Root-cause stage: code-generation
- Planned fix: 上の 3 ファイルを oxfmt で整形し、`bun run check` をやり直す。
- Estimated impact: effort: minutes; financial cost: none; risk: format-only
