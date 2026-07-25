# Bolt Plan — AIDLC Guide

> ステージ: delivery-planning (Inception 2.8) / 作成日: 2026-07-23 / lead: delivery + architect support
> 入力: unit-of-work.md（9 Unit）+ unit-of-work-dependency.md（DAG・エッジ注記）+ unit-of-work-story-map.md + requirements.md + stories.md + mockups.md + components.md + team-practices.md
> 方針（承認済み）: walking-skeleton-first + 依存順（Q1）/ 7 Bolt（Q2）/ 直列基本・B5 のみ並行可（Q3）/ Construction 設計イテレーション = **unit-major**（Q4）。
> practices 解決: Way of Working = trunk-based・Bolt は squash-merge で main へ / Walking Skeleton = **on**・スライス確定済み / Deployment = local-only（環境・CD なし）— いずれも team.md（最specific非空）。

## Bolt シーケンス（直列。B5 のみ B4 と並行可）

### Bolt 1: walking-skeleton 🦴（ソロ・ゲート必須）

- **Unit**: U1 reader-core（parse の最小断面）+ U5 dashboard-server（`GET /api/workflow` のみ）+ U6 dashboard-ui（NowStrip のみ）の薄い E2E スライス
- **スライス**（team.md 確定）: 「状態ファイルを1つ読む → Dashboard の Now strip を1画面描画する」
- **証明するアーキテクチャ層**: FS読取（ReadResult 境界）→ ライブラリ消費（一方向依存）→ HTTP 供給（段階的初回描画の第1段）→ React 描画（トークン最小適用）— 全統合点を最小構成で貫通
- **Definition of Done**: tb-lxp の `aidlc-state.md` 1枚をパースし、ブラウザの Now strip に phase/stage/unit/gate/完了数が表示される。パーサは `parse/` に隔離され ReadResult を返す。bun workspaces の 7 パッケージ骨組み + Biome + Vitest + ローカルゲート（`bun run check` 相当）が動く
- **確信仮説**: 「reader-core → dashboard-server → dashboard-ui の一方向データフローが、確定した構造規約（ファサード/Result/依存方向）のまま実データで成立する」
- **デモ**: `bun run dashboard` → ブラウザで Now strip が tb-lxp の現在地を表示
- **ゲート**: 必須（walking skeleton は autonomy モードに関わらず人間承認。承認後にラダープロンプト）

### Bolt 2: reader-core 完成

- **Unit**: U1 reader-core（残り全部: tree / audit / intents / watch / fail-soft）
- **DoD**: FR-1.1〜1.5 の AC + US-15 の5失敗モード fixture 各1件が green。tb-lxp ゴールデンテスト + パーサブランチカバレッジ重視（team.md）。空ワークスペース表示
- **確信仮説**: 「593ファイル規模の実インテントを、部分破損を含めて落ちずに型付きモデル化できる」
- **デモ**: golden テスト一式 + 壊した fixture での局所縮退

### Bolt 3: docs-bridge + mcp-server（M1 完成）

- **Unit**: U2 docs-bridge + U4 mcp-server
- **DoD**: MCP 5ツールが実データで応答（US-09b AC、read_artifact 3ベクタ拒否）。slug→docs 対応表が Dashboard/MCP 共用の単一ソース（US-23）。`.mcp.json` 登録手順が README に
- **確信仮説**: 「サイドセッションの Claude Code が `aidlc_status` / `aidlc_explain_stage` に実データで答えられる」（PRD M1 完了条件そのもの）
- **デモ**: Claude Code から 5ツールを呼んで応答を確認

### Bolt 4: dashboard-server + dashboard-ui 完成（M2 核）

- **Unit**: U5 dashboard-server（/api/matrix・WS・AnswerWriter・bind 制御）+ U6 dashboard-ui（StageRail/Matrix/StageCard/NextStepCallout/SKIP/a11y/テーマ）
- **DoD**: US-01/02/03/05/16/18 の AC + S-1 到達性基準（Now strip 単体 + 1クリック次ステップ）+ 段階的初回描画（matrix-ready push）+ a11y チェックリストの自動検証分
- **確信仮説**: 「初学者が Dashboard だけで現在地・次ステップ・全体像を把握できる（S-1 の実装到達）」
- **デモ**: tb-lxp で Now strip → NextStepCallout → マトリクスの一連の閲覧
- **並行**: B5 btw をこの Bolt と並行実行してよい（完全独立 Unit — Q3）

### Bolt 5: btw（M2 完成）∥ B4 と並行可

- **Unit**: U3 btw
- **DoD**: US-06/07/08 の AC（OS別 spawn スモーク、--fork の ID 解決、help に fork 制約 + /branch 案内）
- **確信仮説**: 「ドライバーが本線を汚さず 1 コマンドで調べ物を開始できる」
- **デモ**: Windows Git Bash + macOS で `btw` / `btw --fork` / `btw -p`

### Bolt 6: artifact-viewer（M3）

- **Unit**: U7 artifact-viewer
- **DoD**: **冒頭に Milkdown 実データ検証（FR-6.1 の 5成果物×5項目チェックリスト。不合格なら BlockNote/plain preview へ交代し ADR-05 を更新）** → US-13/14 の AC（WYSIWYG+Mermaid、Answer 行 byte-invariance 編集）
- **確信仮説**: 「実成果物（テーブル・Mermaid 混在）が WYSIWYG で崩れず読め、唯一の書込が安全」
- **デモ**: tb-lxp 成果物 5件の表示 + 質問ファイルへの回答記入

### Bolt 7: mob-mode + ops-guides（M4 完成）

- **Unit**: U8 mob-mode + U9 ops-guides
- **DoD**: US-10/11/19 の AC（--host 警告・参加者 read-only のサーバ側担保・ライブ反映）+ US-12/22 のガイド2本（ADR-04「モブ中の回答記入」節必須）
- **確信仮説**: 「モブ参加者が口頭確認なしにドライバーの状態を追える（S-2）」
- **デモ**: 2ブラウザ（ドライバー/参加者）でのライブ反映 + ガイドどおりの Live Share 手順

## Bolt 後の一括ステージ

build-and-test (3.6) と ci-pipeline (3.7) は全 Bolt 完了後に一括実行（Bolt ごとではない — stage-protocol 用語定義どおり）。performance-validation (4.6) は NFR-2/3 の実測（local-only の「リリース」検証 — team.md Deployment）。

## Construction イテレーション

**unit-major**（Q4）: 各 Unit の設計文書（3.1 functional / 3.2 nfr-req / 3.3 nfr-design。3.4 は SKIP）を連続して書き、次の Unit へ。ゲートは各設計ステージ1回、設計ブロック末尾にカスケード。`set-construction-iteration unit-major` を記録済み。
