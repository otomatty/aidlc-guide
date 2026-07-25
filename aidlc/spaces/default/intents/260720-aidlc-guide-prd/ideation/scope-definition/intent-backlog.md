# Intent Backlog — AIDLC Guide（proto-Units）

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-07-21
> 粒度: 機能グループ基準 + 大きいもの（F-01, F-04, F-06）は分割（Q5回答）。
> 優先度: 全機能 Must（scope-document.md 参照）のため、順序は依存順（M1→M4）+ マイルストーン内は基盤先行。
> 入力: intent-statement.md / feasibility-assessment.md / constraint-register.md。Units Generation（Inception 2.7）で正式な Unit of Work に精緻化される。

## バックログ（依存順）

| # | proto-Unit | 由来 | M | 概要 | 依存 |
|---|-----------|------|---|------|------|
| PU-01 | reader-core | F-01 | M1 | state パース（State Version 検知・解析不可フォールバック）、成果物ツリー走査（Unit×Stage マトリクス構築）、監査イベント抽出、アクティブインテント解決 | — |
| PU-02 | reader-watch | F-01 (FR-1.5) | M1 | chokidar によるファイル監視。state・construction 配下の変更でモデル追従 | PU-01 |
| PU-03 | mcp-server | F-02 | M1 | MCP TypeScript SDK (stdio)。読み取り専用5ツール（status / explain_stage / next_steps / read_artifact / glossary） | PU-01, PU-09（explain/glossary が docs 対応表を参照） |
| PU-04 | btw-wrapper | F-03 | M2 | 読み取り専用サイドセッション起動・`--fork` 分岐・`-p` ヘッドレス質問。fork 制約のヘルプ明記 | —（Claude Code 機構のみ） |
| PU-05 | dashboard-shell | F-04 (FR-4.1) | M2 | ローカル Web 骨格（Vite + React）+ Now strip（フェーズ/ステージ/ユニット/Depth/完了数） | PU-01, PU-02 |
| PU-06 | stage-rail | F-04 (FR-4.2, 4.4, 4.5) | M2 | ステージ一列表示・状態色分け・クリック遷移・初学者向けステージカード・SKIP折りたたみ | PU-05, PU-09 |
| PU-07 | unit-stage-matrix | F-04 (FR-4.3) | M2 | 行=ユニット × 列=Constructionステージ。成果物有無・件数・レビュー verdict 表示 | PU-05 |
| PU-08 | docs-bridge | F-05 | M2 | slug→docs 対応表（静的・Dashboard/MCP 共用）+ docs リポジトリパス設定 + プロジェクト固有リンク欄 | — |
| PU-09 | （PU-08 に統合） | — | — | ※対応表は docs-bridge が単一所有。PU-03/PU-06 は参照のみ | — |
| PU-10 | wysiwyg-viewer | F-06 (FR-6.1, 6.3) | M3 | Milkdown 実データ検証（冒頭・feasibility R-2）→ WYSIWYG 表示 + Mermaid レンダリング。既定読み取り専用 | PU-05 |
| PU-11 | answer-editing | F-06 (FR-6.2) | M3 | `*-questions.md` の `[Answer]:` 記入のみ許可（ファイル名パターン制御）。F-06 内部優先順で閲覧の後（Q4回答） | PU-10 |
| PU-12 | mob-mode | F-07 | M4 | `--host` LAN公開（既定 localhost — C-T6）+ ファイル監視→WebSocket push + 参加者 read-only 固定 | PU-05〜PU-07, PU-10 |
| PU-13 | ops-guides | F-08 | M4 | Live Share 運用ガイド + 非同期共有規約（ゲート時 git push フック手順 + checkout 不要閲覧手順） | —（文書のみ） |

（PU-09 は docs-bridge への統合により欠番。以降のステージでは PU-08 を参照。）

## 価値ストリーム（capability → 顧客成果）

- **現在地の理解**（PU-01→PU-03→PU-05/PU-06）→ 初学者が1分以内に現在地を説明できる（S-1 北極星）
- **本線を汚さない調べ物**（PU-03 + PU-04）→ ドライバーのやり直し削減（S-3）・自己解決率向上（S-4）
- **成果物の閲覧**（PU-07 + PU-10/PU-11）→ 593ファイル規模でも全体像・欠落が見える（P-2 解消）
- **ライブ共有**（PU-12 + PU-13）→ モブ参加者が口頭確認なしに状態把握（S-2）

## 配送性の検証（デリバリー観点）

- 各マイルストーンが独立に検証可能（PRD §9 の完了条件）で、依存順の直列進行と整合
- PU-01（reader-core）が最大の共通依存 — 最初の Bolt 候補。ここで tb-lxp フィクスチャの clone（feasibility A-2）と State Version 7 パースの実証を済ませると後続の不確実性が最小化される
- PU-13（文書のみ）は実装と並行可能で、M4 の緩衝になる
