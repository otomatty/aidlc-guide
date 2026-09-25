# インフラ仕様

クラウドの資源は置かない。この変更が使う実行場所は、拡張ホストと、開発者の手元の `bun run check` だけである。

## Deployment

| Facet | Choice | Rationale |
| --- | --- | --- |
| 計算 | 拡張ホスト（VS Code 同梱の Node）の中で api-core を動かす | 第一サーフェスは拡張。別プロセスやコンテナは足さない |
| ネットワーク | なし。待ち受けを新設しない | 会話の保存も質問も、このマシンの中で閉じる |
| 保存 | `ExtensionContext.globalState` | ワークスペースのファイルにもクラウドにも書かない |
| 環境 | 開発者の手元だけ。staging / production は無い | ローカル専用。リリースは `main` への squash-merge または git タグ |
| IaC | なし | プロビジョニングする資源が無い |
| 容量 | 件数の上限は置かない | 信頼性の設計と同じ。溢れたら捨てる規則は無い |

## Infrastructure Services

| Service | Role | Configuration | Notes |
| --- | --- | --- | --- |
| なし | — | — | データベース、キャッシュ、キュー、検索、CDN、DNS、ロードバランサは新設しない |

質問ジョブはプロセス内の 1 件のまま。回答は既存のローカル CLI のまま。
