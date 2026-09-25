# 論理コンポーネント

新しいサービスは切らない。失敗が広がる範囲は、このインストールの会話と、進行中の 1 件である。

| 部品 | 置き場 | 持つもの | 失敗したとき |
| --- | --- | --- | --- |
| チャット画面 | `packages/dashboard/src/features/docs` | 表示と送信。会話は持たない | 短いメッセージを入力のそばに出す |
| 質問の処理 | `packages/api-core` の docs-qa（ask / job / cancel / evidence） | 進行中 1 件。ローカル CLI | その 1 件が終わり、次を送れる |
| 会話の保存 | 拡張ホストの `ExtensionContext.globalState` | ターン一覧と書きかけ | ワークスペースのファイルは増えない |
| 品質ゲート | `bun run check` と `vitest.config.ts` の `coverage.thresholds` | UI テスト、契約テスト、カバレッジ下限 | 下限を欠く変更は通らない |

`dashboard` は `reader-core` を import しない。ホストモードの拒否は、画面と質問の処理の両方に効く。
