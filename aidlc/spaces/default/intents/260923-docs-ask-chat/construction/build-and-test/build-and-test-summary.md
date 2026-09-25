# ビルドとテストのまとめ

docs-ask-chat は 1 単位。新しいサービスやデータベースはない。確認はリポジトリルートの `bun run check` と、境界をまたぐ Vitest で行う。

## 前提

依存は `bun install`。実行に必要な環境変数はない。テスト戦略は Standard なので、追加の指示は結合テストだけを書いた。性能とセキュリティの数値は、同じ `bun run check` と既存の契約テストが測る。

## テストの種類

| 種類 | ファイル |
| --- | --- |
| ビルドと品質ゲート | `build-instructions.md` |
| 結合 | `integration-test-instructions.md` |
| 単体 | コード生成の `unit-test-instructions.md` |

性能テストとセキュリティテストの専用ファイルは、Standard では作らない。測定できる目標は下の表に残す。

## 単位ごとのカバレッジ

| 単位 | 期待 |
| --- | --- |
| docs-ask-chat | docs-qa ハンドラの分岐 70% 以上。ワークスペース行 80%。既存 95% ブロックは維持 |

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| NFR1.1 | nfr-requirements/observability-requirements.md | チャット画面の UI テストが `bun run check` に含まれる | check がフォーマットで停止 | format:check | build-and-test | Unverified |
| NFR1.2 | nfr-requirements/observability-requirements.md | 契約テストが `bun run check` に含まれる | check がフォーマットで停止 | format:check | build-and-test | Unverified |
| NFR1.3 | nfr-requirements/observability-requirements.md | 先に失敗するテストを書き、それから実装する | この実行では再確認していない | code-summary.md | code-generation | Unverified |
| NFR2.1 | nfr-requirements/performance-requirements.md | docs-qa の分岐カバレッジ 70% 以上 | 未測定 | test:coverage 未到達 | build-and-test | Unverified |
| NFR2.2 | nfr-requirements/performance-requirements.md | 既存の分岐 95% 下限が残る | 未測定 | test:coverage 未到達 | build-and-test | Unverified |
| NFR2.3 | nfr-requirements/performance-requirements.md | ワークスペースの行カバレッジ 80% | 未測定 | test:coverage 未到達 | build-and-test | Unverified |
| NFR3.1-reliability | nfr-requirements/reliability-requirements.md | 閉じたあと、保存したターンと書きかけが残る | 6 件成功 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.1-security | nfr-requirements/security-requirements.md | 会話はローカル保存のみ。ワークスペースのファイルには書かない | 6 件成功 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.2 | nfr-requirements/security-requirements.md | 保存のためにクラウドへ送らない | 契約テストはローカルのみ | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-reliability | nfr-requirements/reliability-requirements.md | 進行中は 1 件。キャンセルか完了か失敗で終わる | 契約テスト成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-scalability | nfr-requirements/scalability-requirements.md | 同時処理は 1 件。2 件目は拒否する | 契約テスト成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR5.1 | nfr-requirements/security-requirements.md | ホストモードでは送信、取得、キャンセル、根拠の取得を拒否する | 契約テスト成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |

## 準備

ビルド手順は実行した。品質ゲートはフォーマットで失敗し、カバレッジには到達していない。境界の Vitest は 76 件成功している。配置の準備は、この変更がローカル専用のため対象外である。

## 残っていること

未整形の 3 ファイルを直してから `bun run check` をやり直す必要がある。未測定の目標は Unverified のままなので、このステージはまだ成功していない。
