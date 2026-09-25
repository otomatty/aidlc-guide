# ビルドとテストのまとめ

docs-ask-chat は 1 単位。新しいサービスやデータベースはない。確認はリポジトリルートの `bun run check` と、その中に含まれる境界の Vitest で行った。

## 前提

依存は `bun install`。実行に必要な環境変数はない。テスト戦略は Standard なので、追加の指示は結合テストだけを書いた。性能とセキュリティの数値は、同じ `bun run check` と既存の契約テストが測る。

セキュリティの確認は、ローカル保存、ホストモードの拒否、`bun audit` の 0 件に閉じる。クラウドの走査や遠隔の計測は置かない。

## テストの種類

| 種類 | ファイル |
| --- | --- |
| ビルドと品質ゲート | `build-instructions.md` |
| 結合 | `integration-test-instructions.md` |
| 単体 | コード生成の `unit-test-instructions.md` |

性能テストとセキュリティテストの専用ファイルは、Standard では作らない。測定できる目標は下の表に残す。

## 単位ごとのカバレッジ

| 単位 | 期待 | 実測 |
| --- | --- | --- |
| docs-ask-chat | docs-qa ハンドラの分岐 70% 以上。ワークスペース行 80%。既存 95% ブロックは維持 | 行 88.96%。分岐の全体は 81.68%。docs-qa の 70% と既存 95% は閾値を通過 |

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| NFR1.1 | nfr-requirements/observability-requirements.md | チャット画面の UI テストが `bun run check` に含まれる | 画面テストを含むゲートが成功 | `bun run check` 終了コード 0 | build-and-test | Met |
| NFR1.2 | nfr-requirements/observability-requirements.md | 契約テストが `bun run check` に含まれる | 契約テストを含むゲートが成功 | `bun run check` 終了コード 0 | build-and-test | Met |
| NFR1.3 | nfr-requirements/observability-requirements.md | 先に失敗するテストを書き、それから実装する | 計画の Red 手順 Step 2、5、8、11 は完了済み | code-generation-plan.md | code-generation | Met |
| NFR2.1 | nfr-requirements/performance-requirements.md | docs-qa の分岐カバレッジ 70% 以上 | 閾値 70% を通過 | `bun run check` のカバレッジ | build-and-test | Met |
| NFR2.2 | nfr-requirements/performance-requirements.md | 既存の分岐 95% 下限が残る | 95% 閾値を通過 | `bun run check` のカバレッジ | build-and-test | Met |
| NFR2.3 | nfr-requirements/performance-requirements.md | ワークスペースの行カバレッジ 80% | 行 88.96% | `bun run check` のカバレッジ | build-and-test | Met |
| NFR3.1-reliability | nfr-requirements/reliability-requirements.md | 閉じたあと、保存したターンと書きかけが残る | 保存テストが成功 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.1-security | nfr-requirements/security-requirements.md | 会話はローカル保存のみ。ワークスペースのファイルには書かない | 保存テストが成功。監査は脆弱性 0 件 | docs-conversation.test.ts | build-and-test | Met |
| NFR3.2 | nfr-requirements/security-requirements.md | 保存のためにクラウドへ送らない | 契約テストはローカルのみ | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-reliability | nfr-requirements/reliability-requirements.md | 進行中は 1 件。キャンセルか完了か失敗で終わる | 契約テスト成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR4.1-scalability | nfr-requirements/scalability-requirements.md | 同時処理は 1 件。2 件目は拒否する | 契約テスト成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |
| NFR5.1 | nfr-requirements/security-requirements.md | ホストモードでは送信、取得、キャンセル、根拠の取得を拒否する | 契約テスト成功 | docs-qa-chat-contract.test.ts | build-and-test | Met |

## 準備

ビルドもテストも通った。測定した目標は Met。配置の準備は、この変更がローカル専用のため対象外である。

## 残っていること

要件本文の FR と NFR の親 ID は、単位の traceability に ID として載っていない。受入条件 19 件は載っていて、対象ファイルもある。詳細は `cross-unit-traceability.md`。
