# Scope Document — AIDLC Guide

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-07-21
> 入力: intent-statement.md（ideation/intent-capture/）+ feasibility-assessment.md / constraint-register.md（ideation/feasibility/）+ scope-definition-questions.md の回答
> PRD §5（機能要件）・§8（スコープ外）・§9（マイルストーン）を境界の基礎とする。

## スコープ内（IN）

intent-statement.md の実装範囲確定（M1〜M4すべて）に基づき、PRD の全機能グループを実装する。**全機能 Must**（Q1/Q6回答: 切り下げは想定しない）。

| 機能 | 内容 | マイルストーン |
|------|------|--------------|
| F-01 aidlc-reader | 状態モデルライブラリ（state パース・成果物ツリー走査・監査イベント抽出・アクティブインテント解決・ファイル監視） | M1 |
| F-02 MCP サーバー | `aidlc_status` / `aidlc_explain_stage` / `aidlc_next_steps` / `aidlc_read_artifact` / `aidlc_glossary` の5ツール | M1 |
| F-03 btw ラッパー | 読み取り専用サイドセッション起動・fork分岐・ヘッドレス質問 | M2 |
| F-04 Dashboard | Now strip / Stage rail / Unit×Stageマトリクス / ステージカード解説 / SKIP折りたたみ | M2 |
| F-05 Docs Bridge | slug→公式docs対応表（Dashboard/MCP共用）+ 設定でパス指定 | M2 |
| F-06 WYSIWYG ビューア | Markdown WYSIWYG表示 + Mermaidレンダリング + 質問ファイル回答記入 | M3 |
| F-07 Mob モード | LAN公開 + WebSocket push + read-only参加者ビュー | M4 |
| F-08 運用ガイド | Live Share運用ガイド + 非同期共有規約 | M4 |

**F-06 内部の優先順**（Q4回答）: WYSIWYG閲覧・Mermaid表示（FR-6.1/6.3）＞ 質問ファイル回答記入（FR-6.2 は M3 内で閲覧機能の後に実装）。

## スコープ外（OUT）

PRD §8 のとおり（constraint-register.md スコープ制約と同一）:

- aidlc の状態・成果物への書き込み（質問ファイルの `[Answer]:` を除く）
- AI による成果物の自動要約・自動レビュー
- 全文検索エンジン
- 複数インテント・複数スペースの横断ビュー
- 認証付きの社外公開ホスティング
- aidlc-workflows 本体の変更（PRD §2 非ゴール）
- 旧バージョンの state 形式サポート（feasibility Q1: 現行 State Version 7 限定）

## 価値の下限と切り下げ方針

- **切り下げは想定しない**（Q6回答）。M4完了まで価値は不可分（Q2回答）— 3ペルソナ均等の方針（intent-statement）どおり、閲覧（初学者）・サイドセッション（ドライバー）・ライブ共有（モブ参加者）がそろって完全な価値となる
- スコープ変更が必要になった場合は、この文書を基点にゲートで正式に再判断する（勝手なスコープ縮小をしない）

## 実装順序の方針

**依存順（dependency-first）** — Q3回答。PRD §9 のマイルストーン順を維持する:

```
M1: F-01 aidlc-reader → F-02 MCP サーバー   ← 基盤。全サーフェスが依存
M2: F-03 btw / F-04 Dashboard / F-05 Docs Bridge  ← reader の上に構築
M3: F-06 WYSIWYG ビューア（冒頭に Milkdown 実データ検証 — feasibility R-2）
M4: F-07 Mob モード / F-08 運用ガイド
```

各マイルストーンの完了条件は PRD §9 のとおり。tb-lxp フィクスチャ（別リポジトリ、要clone — feasibility A-2）を読み取りテストに使用する。

## タイムライン制約との整合

期限制約なし・品質優先（feasibility Q5 / constraint-register C-O3）。依存順の直列進行でスケジュールリスクはない。
