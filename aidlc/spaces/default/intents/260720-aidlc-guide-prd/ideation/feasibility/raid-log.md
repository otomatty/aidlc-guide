# RAID Log — AIDLC Guide

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-07-21
> Risks / Assumptions / Issues / Dependencies。intent-statement.md と PRD §11 を基点に、feasibility-questions.md の回答で更新。
> 起票規約: ID接頭辞 R/A/I/D + 連番。Status: Open / Monitoring / Closed。

## Risks（リスク）

| ID | リスク | 可能性 | 影響 | 対応 | Status |
|----|--------|--------|------|------|--------|
| R-1 | aidlc-workflows のバージョンアップで state / ディレクトリ構造が変わり reader が壊れる | 中 | 高 | パーサ1モジュール隔離 + State Version 分岐 + 解析不可フォールバック（NFR-6）。現行版限定サポート（C-T3）で互換負債を持たない | Open |
| R-2 | Milkdown が実成果物の記法（テーブル・Mermaid混在）を崩す | 中 | 中 | M3冒頭に実成果物での表示検証（Q3回答）。不適なら BlockNote / plain preview へ交代。期限制約なし（C-O3）のため交代コストは吸収可能 | Open |
| R-3 | `--fork-session` の JSONL フラッシュ制約で分岐セッションに直近文脈が乗らない | 高（仕様） | 低 | 制約をヘルプに明記し本線内 `/branch` を第一案内（FR-3.4）。解決は狙わない | Monitoring |
| R-4 | NFR-2（3秒起動）が593ファイル規模で未達 | 低〜中 | 中 | 遅延読み込み・キャッシュ設計を application-design で考慮。performance-validation で実測 | Open |
| R-5 | トンネル公開（cloudflared 等）を認証なしで行い社内情報が露出する | 低 | 高 | ツール本体は localhost 既定 + LAN明示フラグ（C-T6）。トンネルは手順ドキュメント側で認証を注意喚起（C-R2） | Open |

（PRD §11 の「Live Share が組織ポリシーで使えない」リスクは Q4回答（使用可能）により解消 — Closed として記録: R-x廃番）

## Assumptions（前提）

| ID | 前提 | 検証方法 | Status |
|----|------|---------|--------|
| A-1 | チームは bun + TS / Vite + React に習熟しており追加学習コストは無視できる | PRD §7「チーム標準」の宣言 | Closed（確認済み扱い） |
| A-2 | tb-lxp フィクスチャは別リポジトリから clone でき、読み取りテストに使用できる | M1 開始時に clone して確認（Q2回答） | Open |
| A-3 | PRD v0.1 は承認済みベースラインとして扱える | intent-capture Q1 で確認済み（project.md ## Decided に永続化） | Closed |
| A-4 | Claude Code の標準セッション機構（独立起動 / `/branch` / `--fork-session`）は現行版で利用できる | M2 の btw 実装時に実機確認 | Open |

## Issues（顕在化した問題）

| ID | 問題 | 対応 | Status |
|----|------|------|--------|
| — | 現時点でなし | — | — |

## Dependencies（依存関係）

| ID | 依存 | 種別 | 対応 |
|----|------|------|------|
| D-1 | aidlc-workflows の状態ファイル形式・ディレクトリ構造（読み取り対象） | 外部（同組織） | 現行版に固定（C-T3）。変更検知は State Version フィールド |
| D-2 | tb-lxp フィクスチャリポジトリ（性能・読み取りテスト） | 外部（同組織） | M1 開始時に clone（A-2） |
| D-3 | VS Code Live Share（Mob モードの共有基盤） | 外部（Microsoft） | 使用可能確認済み（Q4回答）。障害時代替: tmux 共有 / Dashboard 単独（PRD §11） |
| D-4 | Claude Code セッション機構（btw ラッパーの土台） | 外部（Anthropic） | 薄いラッパーに徹し、機構変更の影響面を最小化（PRD §4） |
| D-5 | Milkdown / Crepe（WYSIWYG 第一候補） | 外部（OSS） | M3 冒頭検証で採否判断（R-2） |
| D-6 | 公式 docs リポジトリ（Docs Bridge の deep-link 先） | 外部（同組織） | ローカル clone パスを設定ファイルで指定（FR-5.2） |
