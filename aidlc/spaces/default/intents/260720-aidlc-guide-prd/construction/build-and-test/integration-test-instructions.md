# Integration Test Instructions — AIDLC Guide

> build-and-test (3.6) / Test Strategy: **Standard** / 2026-07-25
> 入力: 全9 Unit の `code-summary.md`（Unit 間の契約）+ `inception/application-design/component-dependency.md`
> 対象: **Unit 境界を跨ぐ挙動**。Unit 内部に閉じた検証は `unit-test-instructions.md`。

## 統合の境界（何を跨ぐか）

```
reader-core ──▶ dashboard-server ──HTTP/WS──▶ dashboard(SPA) ──lazy──▶ artifact-viewer
     │                                              ▲
     ├──▶ mcp-server (stdio)                        │
     └──▶ docs-bridge ──────────────────────────────┘
btw ──spawn──▶ Claude Code（plan モード）
```

reader-core は UI/トランスポート非依存（team.md 構造規約1）であり、逆依存は禁止。統合テストはこの一方向性を前提に、**上位が下位の実物を使う**形で書く。

## 実行

統合テストは同じコマンドに含まれる（別コマンドを設けない — ローカルゲートは1本という team.md の方針）:

```bash
bun run test
```

境界別に絞り込む場合:

```bash
bunx vitest run packages/dashboard-server/tests/server-smoke.test.ts   # 実プロセス HTTP/WS
bunx vitest run packages/mcp-server/tests/server-smoke.test.ts         # 実 stdio
bunx vitest run packages/dashboard/tests/detail-panel.test.tsx         # lazy 境界
```

## 境界1: dashboard-server ⇄ reader-core（実プロセス smoke）

`packages/dashboard-server/tests/server-smoke.test.ts` が **bun の子プロセスを spawn し、実 HTTP/WS で叩く**。Vitest は Node ホストで動くため `Bun.serve` を同一プロセス内で起動できず、この形が唯一の実挙動検証になる。

検証項目:

| 項目 | 期待 | 根拠 |
|------|------|------|
| 既定起動の bind | `127.0.0.1` のみ | BR-MM-1 / NFR-7 |
| `--host` 起動の bind | `0.0.0.0` + 警告文言（成果物 / 監査 / 秘密を含み得る の各語を含む） | BR-MM-2 / US-19 |
| `--host` 起動の出力順 | 警告 → 待受アドレス一覧（読み飛ばされない位置） | S-MM-2 |
| アドレス一覧の形 | `http://<IPv4>:<port>` のみ。ホスト名・ユーザー名・パスを含まない | S-MM-4 |
| NIC 列挙が空のとき | 見出しを吊らせず、検出失敗の案内を出す | R-MM-2 |
| `GET /api/workflow` | `serverMode.hostMode` を含む。matrix は**含まない**（段階的初回描画 ADR-03） | P-DS-1 |
| `--host` 中の `POST /api/answer` | 無条件 403（curl で直接叩いても同じ） | BR-MM-3 |
| ポート衝突時の起動 | 非ゼロ終了 + stderr に理由と `--port` の対処。**ready 行を1行も出さない**（黙って loopback で serve しない） | R-MM-1 / BR-MM-5 |

最後の1件は本ステージ以前に「手動受入項目」へ逃がされていたが、自動化した結果**潜在バグを発見した**（bun のエラー文が errno を含まないため、ポート衝突時の `--port` 助言が一度も出ていなかった）。手動送りの判断は、本当に自動化が困難かを確かめてから行う。

## 境界2: mcp-server ⇄ reader-core / docs-bridge（実 stdio smoke）

`packages/mcp-server/tests/server-smoke.test.ts` が bin を子プロセスとして起動し、実際の stdio トランスポートで5ツールを叩く。

- `aidlc_status` / `aidlc_next_steps` / `aidlc_read_artifact` は reader-core のみに依存（M1）
- `aidlc_explain_stage` / `aidlc_glossary` は docs-bridge 経由（M2）
- `read_artifact` の記録外パス拒否は**3ベクタを列挙的に**検証する（`../` トラバーサル / 記録外への絶対パス / 記録外を指す symlink）。「いずれか1件」で済ませない

## 境界3: docs-bridge の cross-consumer 整合（FR-5.1）

同一 slug に対して Dashboard 側（`GET /api/stage/<slug>`）と MCP 側（`aidlc_explain_stage`）が**同一の docs 該当節**を返すこと。対応表の所有は docs-bridge のみで、他は参照に徹する。

docs-bridge は reader-core に依存しない（`guardPath` を共有せず**意図的に複製**し、`tests/vectors/guard-path-vectors.ts` の共有ベクタ表を**両パッケージが実行する**ことでドリフトをテスト失敗として検出する）。これは zero-runtime-dependency を保つための設計判断であり、共通化は `chokidar` を docs-bridge の依存閉包に持ち込むため採らない。

## 境界4: SPA ⇄ サーバ契約 + 遅延ロード境界

- `packages/dashboard/tests/services.test.tsx` — API クライアントがサーバの `ReadResult` 形をそのまま解釈すること、到達不能を空白画面にしないこと（R-UI-3）
- `packages/dashboard/tests/live.test.tsx` — WS メッセージ（`change` / `matrix-ready` / `live-status`）の適用と、再接続時の全再取得（R-UI-4）
- `packages/dashboard/tests/detail-panel.test.tsx` — **P-AV-2 の並行発火**: クリック直後、`artifact-viewer` がまだ DOM に無い時点で `fetch` が既に1回出ており、チャンク解決後も合計1回のまま（= viewer が進行中 promise を再利用し2本目を出していない）。同じ成果物を開き直すと2回（= コンテンツキャッシュではない）
- `packages/dashboard/tests/mob-mode.test.tsx` — 読み取り失敗を跨いで ReadOnlyBadge が残り、参加者の編集 DOM が現れないこと（+ `hostMode:false` で編集器が出るポジティブコントロール）

## 手動でしか確認できない統合（偽装しない）

以下は**別端末または実ブラウザが必要**で、このスイートには含まれない。`build-and-test-summary.md` の「残存する手動確認」に再掲する。

| ID | 内容 | 手順 |
|----|------|------|
| MA-1 | 既定起動でポートが LAN から**到達不能** | 別端末から `http://<ドライバーの IPv4>:4700` に接続し、失敗すること |
| MA-2 | `--host` 起動でポートが LAN から**到達可能** | 同上で接続でき、参加者ビューが表示されること |
| MA-3 | 参加者ブラウザの DOM に編集要素が無い | 参加者側の devtools で `input, textarea, [contenteditable]` が0件 |
| MA-4 | 参加者側の変更反映が NFR-3 内 | ドライバー側でファイルを変更し、参加者ビューの反映を計測 |
| MA-6 | FR-6.1 チェック項目2（mermaid の実描画） | 実ブラウザで `component-dependency.md` を開き、図として描画されること。jsdom では mermaid をモックしているため未実行 |
| MA-7 | btw の macOS 経路 | macOS で `btw` / `btw --fork` / `btw -p` を実行。Windows 経路のみ実行済み |
