# 性能の実現

待ち時間の新しい予算は置かない。遅い応答を、この変更の失敗条件にしない。このファイルが担うのは、品質ゲートのカバレッジである。

| ID | 実現機構 | 非該当のとき |
| --- | --- | --- |
| NFR2.1 | `vitest.config.ts` の `coverage.thresholds` に、docs-qa の対象パスへ `branches: 70` を足す。実行は `bun run check` | — |
| NFR2.2 | 同じファイルの既存 95% ブロック（`reader-core` の parse、`official-docs` の `resolve.ts` / `roots.ts` / `markdown.ts`）は残す | — |
| NFR2.3 | `vitest.config.ts` の `coverage.thresholds` に、ワークスペース全体の `lines: 80` を足す。既存の 95% ブロックは下げない | — |

キャッシュ、接続プール、CDN、ページングは使わない。再訪のきっかけは、待ち時間そのものを製品の合格条件にする決定である。
