# Feasibility Assessment — AIDLC Guide

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-07-21
> 入力: intent-statement.md（ideation/intent-capture/ — 承認済み）+ PRD §4-§7, §11 + feasibility-questions.md の回答
> 注: market-research はスコープによりSKIPのため、competitive-analysis / market-trends / build-vs-buy の各成果物は存在しない。
> 既製品活用の判断（Live Share・Claude Code標準機構の採用）は PRD §4 の方針をそのまま引き継ぐ。

## 総合判定

**実現可能（GO）。** 技術スタックはチーム標準（bun + TypeScript / Vite + React）で学習コスト・環境構築コストが低く、対象データ（aidlc-state.md・成果物ツリー・監査シャード）はすべてローカルファイルシステム上の構造化Markdownで、読み取りに技術的障壁はない。外部依存の不確実性は Milkdown（M3で検証）と `--fork-session` の挙動（制約明記で回避）に限定されており、いずれも PRD §11 で対応方針が定義済み。

## 技術的実現性（アーキテクト観点）

| 領域 | 判定 | 根拠 |
|------|------|------|
| aidlc-reader（状態パース） | 低リスク | 対象は現行構造のみ（Q1回答: State Version 8 / 2.6.2 限定）。パーサ1モジュール隔離 + State Version分岐の設計方針が PRD §11 で確定済み |
| ファイル監視・追従 | 低リスク | chokidar はクロスプラットフォーム実績あり。593ファイル規模は監視対象として小規模 |
| MCP サーバー | 低リスク | MCP TypeScript SDK (stdio) は Claude Code 標準の統合方法。読み取り専用ツール5種のみ |
| Dashboard | 低リスク | Vite + React はチーム既存スタック。UI比重が高いため rough/refined-mockups ステージで形状を先に固める |
| WYSIWYG（Milkdown） | **中リスク** | テーブル・Mermaid混在の実成果物で崩れる可能性。M3冒頭に実データ検証を置き、不適なら BlockNote / plain preview へ交代（Q3回答・PRD §11） |
| btw ラッパー | 低〜中リスク | `--fork-session` の JSONL フラッシュ制約（本線実行中の直近会話が乗らない）は解決不能な外部制約。FR-3.4 のとおり制約明記 + 本線内 `/branch` 第一案内で受容 |
| Mob モード（WebSocket push） | 低リスク | 自作範囲は構造化ビューの配信のみ。リアルタイム共有の本体は Live Share（Q4回答: ポリシー上使用可能） |
| 起動性能（NFR-2: 3秒/593ファイル） | 低〜中リスク | bun の高速起動 + 遅延読み込みで達成可能な見込み。フィクスチャは別リポジトリのため clone 手順が前提（Q2回答） |

## クラウド・インフラ観点（AWSプラットフォーム）

**該当なし（意図的）。** 本ツールはローカル実行に徹し（intent-statement の読み取り専用原則・PRD §2 非ゴール）、クラウドサービス・DB・ホスティングを一切使用しない（NFR-5: ランタイムは bun のみ）。インフラコストはゼロ。infrastructure-design / 運用系ステージのSKIPは妥当。唯一のネットワーク面は Mob モードの listen（既定 localhost、LAN公開は明示フラグ — NFR-7）で、これはアプリケーション設計の範疇。

## コンプライアンス観点

- **規制フレームワーク**: 該当なし。社内開発者ツールで、扱うデータは自チームのワークフロー成果物・監査ログのみ。PII・決済・医療情報は扱わない
- **社内情報の共有**: LAN共有・トンネル公開とも組織的制約なし（Q6回答）。ただし運用ガイド（F-08）にトンネル公開時の認証注意喚起を記載する（NFR-7 準拠）
- **監査ログの完全性**: 本ツールは読み取り専用原則（NFR-1）により aidlc の監査対象ファイルを変更しない。質問ファイルの `[Answer]:` 記入のみ例外で、これは aidlc-workflows 自体が人間に認めている操作と同一

## 実現性を支える前提

- チームは bun + TypeScript / Vite + React に習熟している（PRD §7「チーム標準」）
- tb-lxp フィクスチャ（約593ファイル）は別リポジトリから clone して入手できる（Q2回答）
- 期限制約なし・品質優先（Q5回答）のため、M3 での Milkdown 交代が発生してもスケジュールリスクにならない
