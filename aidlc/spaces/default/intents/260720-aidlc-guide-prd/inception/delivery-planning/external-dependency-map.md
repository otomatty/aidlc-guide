# External Dependency Map — AIDLC Guide

> ステージ: delivery-planning (Inception 2.8) / 作成日: 2026-07-23
> 入力: bolt-plan.md + unit-of-work.md + requirements.md（Assumptions）
> ローカル完結ツールのため外部依存は軽量（Q5-A の3点）。API 契約・外部チーム・承認リードタイムは無し。

| # | 依存 | 種別 | オーナー | リードタイム | ブロックする Bolt | 緩和策 |
|---|------|------|---------|-------------|-----------------|--------|
| E1 | tb-lxp フィクスチャ（約593ファイル・別リポジトリ） | データ可用性 | 自チーム | clone 数分 | **B1**（骨格の実データ）、**B2**（ゴールデン）、4.6 性能検証 | B1 開始前に clone + **コミットピン**（team.md: 決定的テストのため特定コミット固定）。入手不能時は縮小 fixture を自作（ただし NFR-2 の 593 規模検証は tb-lxp 必須） |
| E2 | aidlc-workflows 公式 docs リポジトリのローカル clone | データ可用性 | 自チーム | clone 数分 | **B3**（docs-bridge の解決先） | パスは設定ファイル指定（FR-5.2）。不在時は docs-bridge が ReadResult error で fail-soft（リンク切れ表示、ツールは落ちない） |
| E3 | Claude Code CLI（`claude` コマンド） | ツール前提 | Anthropic（バージョンは自チーム管理） | インストール済み前提 | **B5**（btw の spawn 先）、B3 の動作確認（.mcp.json 経由） | btw 起動時に CLI 存在チェック + 無ければ導入案内。`--fork-session`/`-p` の挙動はバージョン差があり得るため、btw README に検証済みバージョンを記録 |

## 非該当（明示）

- 外部 API・SaaS: 無し（local-only、クラウド禁止 — project.md Forbidden）
- 外部チームのハンドオフ・承認リードタイム: 無し（単一チーム・AI 実行）
- VS Code Live Share: **ツールの依存ではない**（F-08 ガイドが解説する外部製品。B7 のガイド執筆は Live Share 無しでも完了可能、検証モブのみ要る）
