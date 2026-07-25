# Logical Components — Unit: dashboard-server

> nfr-design (3.3) / Unit: dashboard-server / 2026-07-24
> 入力: functional-design 3文書 + 本ステージ設計文書

## モジュール構成（packages/dashboard-server/src/）

| モジュール | 責務 | 依存 |
|-----------|------|------|
| `cli.ts`（bin） | 引数パース（--port/--host）→ serve() 起動、警告表示 | server.ts |
| `server.ts` | Bun.serve 設定（routes/websocket/静的 fallback）、起動シーケンス、bind 分岐 | 全下位 |
| `handlers/read.ts` | GET 系6ハンドラ（workflow/matrix/artifact/stage/glossary/links）+ mapResult() | reader, bridge |
| `handlers/answer-writer.ts` | POST /api/answer の7ステップ（write 系 import はここのみ） | reader(guardPath) |
| `push.ts` | WS クライアント Set・broadcast・watch 購読・scope 別再取得 | reader |
| `static.ts` | dist/ 配信 + SPA fallback + Cache-Control | — |

## データフロー

```
cli → server.serve()
  ├ 起動: dist check → reader/bridge 生成 → listen → (背景) getMatrix → matrixCache + matrix-ready
  ├ HTTP GET → handlers/read → reader/bridge → mapResult → JSON
  ├ HTTP POST /api/answer → answer-writer（modeゲート→7ステップ）→ {ok}
  └ reader.watch → push.ts（scope別再取得 → 1回直列化 → 全クライアント send）
```

状態: {matrixCache, clients:Set, hostMode:boolean} のみ（server.ts 内）。テスト: fetch レベル（ポート0起動）で全ハンドラ + WS 統合、AnswerWriter はゲート組合せ + golden。

## Review

**Verdict:** READY

- R-DS-2（reliability-design.md L11）: tmp は「書込先と同一ディレクトリに `.answer-tmp-<pid>` 名で作成」と一義的に確定し、OS temp は「使わない」対象として明示されるのみ（ルールとしての言及なし）。自己矛盾は解消。
- SC-DS-2（scalability-design.md L8）: 「reader-core への委譲であり本 Unit に設計なし」と明記の上、根拠（サーバは reader の Matrix を透過するだけで自前データ構造を持たない／matrixCache は reader の Matrix をそのまま保持）が併記されている。unmapped ではなくなった。
- debounce 引用（reliability-design.md L18）: 「reader-core の debounce 設計（functional-design L5: ディレクトリ粒度 300ms — reader-core/functional-design/business-logic-model.md）」と具体ファイル・箇所を引用。本レビューのスコープはユニット横断ファイルへのアクセスを禁じており（sibling 直読み不可、かつ本イテレーションで共有契約は渡されていない）、reader-core 側の記述内容そのものの照合はできないが、未引用だった note は解消済み。
- リグレッション: logical-components.md のモジュール表・データフロー（push.ts の watch 購読、answer-writer.ts の7ステップ、matrixCache 状態）と reliability/scalability 側の記述の間に新たな矛盾は見つからない。
