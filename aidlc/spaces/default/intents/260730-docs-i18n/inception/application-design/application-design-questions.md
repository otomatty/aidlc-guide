# Application Design — 計画質問

> ステージ: application-design (Inception 2.6) / Intent: `260730-docs-i18n`  
> 入力: requirements · stories · codekb architecture · component-inventory · team-practices  
> 推奨値で自動記入（ユーザー指示パターン 2026-07-31）  
> 注: 本プロジェクトはローカル専用 — AWS マッピングは N/A（feasibility / practices 確定）

---

## Q1. Official docs コンテンツ境界

locale FS 読込＋解決ロジックの置き場は？

- A. 新規薄パッケージ `@aidlc-guide/official-docs`（resolve + load + guardPath）。api-core がルートを配線。reader-core は intent 専用のまま
- B. reader-core に折り畳む
- C. api-core ハンドラ内に直書き（ドメイン lib なし）
- X. その他

[Answer]: A

## Q2. ホスト範囲（MVP）

- A. VS Code / Cursor 拡張が Must。dashboard-server は同一 api-core ルートを後で共有可だが本 intent の Done 条件外
- B. 拡張 + dashboard-server を同じ Must スライスで出荷
- C. MCP にも公式 docs ツールを Must で追加
- X. その他

[Answer]: A

## Q3. stage→docs マップの所有者

- A. 静的マップを `official-docs`（または shared 純データ）に置き、docs-bridge は Bridge 縮退／用語補助に限定
- B. すべて docs-bridge に寄せる（既存 bridge-map を公式 path に書き換え）
- C. dashboard のみがマップを持つ（ホストはパスを信頼）
- X. その他

[Answer]: A

## Q4. locale 設定の保存

- A. 拡張 `workspaceState` / webview 永続（ユーザー設定）。リポジトリファイルに書かない
- B. ワークスペース設定ファイル（例: `.aidlc-docs-locale`）
- C. 毎回デフォルト `en`（永続なし）
- X. その他

[Answer]: A

## Q5. Bridge 縮退の実装位置

- A. dashboard の既存 Bridge／抜粋 UI を CTA パネルに置換；docs-bridge excerpt を正本表示に使わない（US-06）
- B. docs-bridge パッケージを削除
- C. 抜粋を残し外部リンクのみ消す
- X. その他

[Answer]: A

## Q6. 通信パターン

- A. 既存どおり同期 request/response（postMessage GET 相当 + `/api/official-docs/:locale/*`）。イベントバスなし
- B. 新規 pub/sub で locale 変更を配信
- C. gRPC / 別プロセス docs サーバ
- X. その他

[Answer]: A
