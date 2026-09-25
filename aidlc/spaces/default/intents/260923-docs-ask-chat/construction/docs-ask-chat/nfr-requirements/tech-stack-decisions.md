# 技術選定

新しい言語、フレームワーク、データベースは選ばない。いまの構成に会話の保存だけを足す。

| 選択 | 理由 |
| --- | --- |
| TypeScript、bun、Vitest、oxlint、oxfmt | リポジトリの現行構成。品質ゲートは単一の `bun run check` |
| 拡張ホスト上の api-core と、dashboard の `features/docs` | 質問経路を分けない。`dashboard` は `reader-core` を import しない |
| `DocsQaResult<T>` | 成否の表現を増やさない |
| 拡張ホストのインストール単位のローカル保存 | 閉じたあとも会話が残る。ワークスペースのファイルには書かない。データベースもクラウドも使わない |
| ローカル CLI | 回答モデルはいまのまま。クラウドの LLM は使わない |

カバレッジの下限は NFR2.1、NFR2.2、NFR2.3 のとおり、既存の Vitest レポートに足す。
