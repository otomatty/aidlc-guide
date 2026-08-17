# Constraint Register — AIDLC Guide

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-07-21
> 入力: intent-statement.md + PRD §2, §6-§8 + feasibility-questions.md の回答

## 技術的制約

| ID | 制約 | 出所 | 影響 |
|----|------|------|------|
| C-T1 | ランタイムは bun のみ。DB・追加ランタイム禁止 | PRD NFR-5 | 状態はファイルシステムから都度読む設計に固定 |
| C-T2 | 読み取り専用。aidlc配下・リポジトリへの書き込み禁止（`*-questions.md` の `[Answer]:` 記入のみ例外） | PRD NFR-1 / intent-statement 読み取り専用原則 | 全サーフェスの書き込みAPIは質問ファイル1経路に限定 |
| C-T3 | サポートは現行 aidlc-workflows（**2.6.2** / State Version **8** / 33 ステージ / 現行ディレクトリ構造）のみ。旧形式（State Version 7 含む）は「解析不可」表示 | Q1回答（「現行のみ」）を 2026-08-14 に 2.6.2 へ再適用 + PRD NFR-6 | パーサはバージョン検知して非対応を明示。多版互換の工数は負わない |
| C-T4 | Windows（Git Bash含む）+ macOS の両対応 | PRD NFR-4 | パス処理・ファイル監視・プロセス起動はクロスプラットフォームで実装 |
| C-T5 | `--fork-session` の JSONL は最終フラッシュ時点。本線実行中の直近会話は分岐に乗らないことがある | PRD FR-3.4 / §11（外部制約・解決不能） | btw のヘルプ・ドキュメントに制約明記。文脈必須時は本線内 `/branch` を第一案内 |
| C-T6 | Mob モードの listen は既定 localhost。LAN公開は明示フラグ必須 | PRD NFR-7 | サーバー起動のデフォルト値で強制 |
| C-T7 | 性能目標: 起動→初回表示 3秒以内、変更→反映 2秒以内（593ファイル規模） | PRD NFR-2/NFR-3 | performance-validation ステージで tb-lxp フィクスチャ（要clone — Q2回答）により計測 |

## 組織的制約

| ID | 制約 | 出所 | 影響 |
|----|------|------|------|
| C-O1 | テストはコードと同時作成、80%ラインカバレッジ、CIで実行（scope由来のテスト方針） | org.md Testing Posture | build-and-test / ci-pipeline ステージの完了条件 |
| C-O2 | trunk-based development、Boltはsquash-mergeでmainへ | org.md Way of Working | Construction の worktree 運用に適用 |
| C-O3 | 期限制約なし。品質優先 | Q5回答 | M3のMilkdown交代等の手戻りを許容 |

## 規制的制約

| ID | 制約 | 出所 | 影響 |
|----|------|------|------|
| C-R1 | 適用される規制フレームワークなし（社内ツール・PII/決済/医療データ非対象） | コンプライアンス観点スキャン（feasibility-assessment.md） | 規制起点のNFRは発生しない |
| C-R2 | 社内情報のLAN共有は制約なし。トンネル公開時の認証注意は運用ガイドに記載 | Q6回答 + PRD NFR-7 | F-08 運用ガイドの記載要件 |

## スコープ制約（やらないこと）

- aidlc-workflows 本体（エンジン・ステージ定義・監査ログ）の変更 — PRD §2
- 成果物の汎用編集・AI自動要約・全文検索・複数インテント横断ビュー・社外公開ホスティング — PRD §8
- クラウドサービス化・アカウント管理 — PRD §2（AWSプラットフォーム観点でもインフラ不要を確認済み）
