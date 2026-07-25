# Application Design — 質問ファイル

> ステージ: application-design (Inception 2.6) / 深度: Standard / lead: architect（aws-platform/design 観点を内包）
> 入力: requirements.md（FR/NFR）+ stories.md（22US）+ team-practices.md（reader-core 一方向依存/パーサ隔離/型付きResult）
> 「1ライブラリ・3サーフェス」+ docs-bridge + btw は確定済み。質問は未決の構造4点（リポ構成・reader API・ブラウザ↔FS 転送・Mob サーバモデル）に絞ります。aws-platform 観点: 本ツールはローカル専用でクラウド/インフラ無し（コストゼロ、project.md）—サービスは全てローカルプロセス。各質問 A-E + X。

---

## Q1. リポジトリ / パッケージ構成（requirements Open Question）

bun + TypeScript。reader-core を UI 非依存に保つ（team.md）ための物理境界は？

- A. bun workspaces のモノレポ。パッケージ分割: `reader-core`（純データ）/ `mcp-server` / `dashboard`（Vite+React）/ `dashboard-server`（ローカル配信）/ `docs-bridge` / `btw` / `shared-types` — 推奨（依存方向をパッケージ境界で強制でき、reader-core の一方向依存が型で守れる）
- B. 単一パッケージ + ディレクトリ分割（軽いが依存方向はlintのみで担保）
- C. reader-core だけ別パッケージ、他はまとめる
- X. その他（記入）

[Answer]: A（bun workspaces モノレポ: reader-core / mcp-server / dashboard / dashboard-server / docs-bridge / btw / shared-types / Mode: batch-recommended）

## Q2. reader-core の公開 API 形状

パーサ隔離・型付き Result（team.md 構造規約）を踏まえた公開形は？

- A. 単一ファサード（例 `createReader(rootPath)`）が内部の隔離モジュール（`parse/` `tree/` `audit/` `watch/`）を束ね、境界は判別可能ユニオンの Result（`{ok}|{unsupported,version}|{error,reason}`）を返し throw しない — 推奨（team.md 3規約に直結）
- B. モジュールごとに個別 export（ファサード無し）
- C. クラスベースのステートフルなリーダーオブジェクト
- X. その他（記入）

[Answer]: A（単一ファサード createReader(rootPath) + 隔離モジュール、境界は判別可能ユニオンResult・throwしない / Mode: batch-recommended）

## Q3. ブラウザ Dashboard が FS データを得る方法（ADR 級）

ブラウザは直接ファイルシステムを読めない。Vite+React の Dashboard に reader-core のデータをどう届ける？

- A. ローカル bun サーバ（`dashboard-server`）が reader-core を呼び、静的アセット配信 + REST（初期ロード）+ WebSocket（push）でブラウザに供給。reader-core はサーバ側のみ（ブラウザに FS アクセスを持ち込まない、一方向依存を維持）— 推奨
- B. Vite の dev サーバのミドルウェア/プラグインで reader-core を実行（開発時前提が強い）
- C. ビルド時に静的 JSON を吐いてブラウザは静的読み（リアルタイム追従 NFR-3 と両立しない）
- X. その他（記入）

[Answer]: A（dashboard-server が reader-core を呼び REST+WebSocket でブラウザ供給。reader-core はサーバ側のみ / Mode: batch-recommended）

## Q4. Mob モードのサーバモデル（NFR-7 / US-10/11/19）

参加者ビューのリアルタイム共有をどう実現する？

- A. `dashboard-server` と同一実装を `--host` フラグで LAN バインド（既定 loopback）。同じ WebSocket チャネルで全参加者に broadcast。参加者向けは書込 API をサーバ側で拒否（read-only を UI でなくサーバで担保、US-11）+ `--host` 時に公開警告（US-19）— 推奨
- B. Mob 用に別サーバプロセスを立てる（実装重複）
- C. Live Share 専用でツール内 WebSocket は持たない（FR-7.2 の自作 push と不整合）
- X. その他（記入）

[Answer]: A（dashboard-server と同一実装を --host で LAN バインド、既定 loopback、参加者書込はサーバ側拒否 + 公開警告 / Mode: batch-recommended）

---

## Consolidated Summary Confirmation

- Q1: A — bun workspaces モノレポ（7パッケージ）
- Q2: A — 単一ファサード + 型付きResult
- Q3: A — dashboard-server 経由（REST+WS）
- Q4: A — 同一サーバの --host モード

Does this look correct before I generate the 5 design artifacts (components / component-methods / services / component-dependency / decisions)?

- Looks correct: この方針で成果物を生成する
- Request changes: 方針を修正する

[Answer]: Looks correct（2026-07-23 / Mode: batch-recommended）

---

## §13 Learnings（回答済み — 2026-07-23）

- A. c1: 段階的初回描画（NFR-2 機構）
- B. c2: ADR トレードオフの受け皿義務
- C. c3: --host モード選択
- D. 残さない

[Answer]: A（c1のみ — project.md ## Decided へ永続化。c2/c3 は memory.md 保持）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
