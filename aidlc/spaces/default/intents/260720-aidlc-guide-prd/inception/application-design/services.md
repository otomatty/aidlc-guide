# Services — AIDLC Guide

> ステージ: application-design (Inception 2.6) / 作成日: 2026-07-23
> 入力: components.md + requirements.md + team-practices.md
> aws-platform 観点: クラウドサービス無し（project.md「クラウド・AWSを一切使用しない」）。「サービス」= ローカルで起動するプロセス。スケーリング・冗長化は非該当（単一ユーザー/単一チームのローカルツール）。

## サービス（ローカルプロセス）一覧

| サービス | 種別 | 起動 | ライフサイクル |
|---------|------|------|--------------|
| S1 mcp-server | stdio 常駐 | Claude Code が `.mcp.json` 経由で spawn | Claude Code セッションと同寿命 |
| S2 dashboard-server | HTTP/WS 常駐 | `bun run dashboard`（ユーザー手動） | ユーザーが止めるまで。`--host` で Mob モード |
| S3 btw | ワンショット CLI | ユーザー手動 | 起動即終了（子のセッションは独立） |

React SPA（dashboard）は S2 が配信する静的アセットであり、独立プロセスではない。

## オーケストレーション（choreography、中心なし）

- 3サービスは互いに通信しない。**共有するのはファイルシステム（唯一の真実のソース — NFR-5）と reader-core ライブラリのみ**。
- S1 と S2 が同時に走っても、両者とも読み取り専用（+ S2 の Answer 行書込のみ）なので競合しない。書込は S2 の AnswerWriter 1経路・アトミック書込（tmp+rename）で行う。
- 変更検知は各プロセスが自分の reader-core `watch()` を持つ（プロセス間イベントバス不要 — ファイルが真実）。

## 通信契約

| 経路 | プロトコル | 契約 |
|------|-----------|------|
| Claude Code ↔ S1 | MCP (stdio/JSON-RPC) | 5ツール（component-methods.md） |
| ブラウザ ↔ S2 | HTTP REST + WebSocket | `/api/*` + `/ws`（component-methods.md）。スナップショット + 差分 push |
| S1/S2 ↔ FS | ファイル読取 | reader-core の ReadResult 契約。書込は S2 の `POST /api/answer` のみ |
| S3 ↔ Claude Code CLI | プロセス spawn | `--permission-mode plan` / `--fork-session` / `-p` |

## スケーリング / 性能特性

- スケーリング概念なし（ローカル単一プロセス）。性能要件は NFR-2（コールド起動→初回描画 3秒 @593ファイル）と NFR-3（変更→反映 2秒）。
- **NFR-2（コールド初回）への機構 — 段階的初回描画**: 初回の未キャッシュ構築こそが NFR-2 の測定対象なので、「一括構築→キャッシュ」では初回を bound できない。S2 は読取を2段に分ける:
  1. **第1段（first paint 経路）**: `GET /api/workflow` は **state ファイル1枚のパース + next-step 解決のみ**で応答（Now strip + Stage rail に必要な全フィールド。593ファイル走査を含まない — 対象は `aidlc-state.md` 1ファイル）。Dashboard はこれで初回描画を完了する（FR-4.1 の S-1 第一要素は matrix なしで成立）。
  2. **第2段（背景構築）**: マトリクス（FR-1.2 の全走査）と監査抽出は初回応答後に非同期構築し、完了時に WS で push（UI は matrix 領域のみ loading→success）。
  - これにより「起動→初回表示」のクリティカルパスはプロセス起動 + 1ファイルパース + SPA ロードに縮まり、593ファイル規模の走査は初回表示時間から外れる。全走査を含む完全表示時間と合わせ、両方を performance-validation（US-20）で実測する。
- S2 のキャッシュ + WS 差分更新は**2回目以降と追従（NFR-3）**のための機構（毎リクエスト全走査しない）。watch はディレクトリ粒度で debounce。
- Mob モード時も同一プロセス（Q4-A）: 参加者数はモブ規模（〜10人）想定で、broadcast のファンアウトは無視できる規模。

## セキュリティ境界（NFR-7）

- S2 の bind は既定 `127.0.0.1`。`--host` 指定時のみ LAN + 起動時公開警告（何が公開されるかを名指し — Mandated）。
- 参加者モード（`--host` 起動時）: `POST /api/answer` をサーバ側で 403（US-11。DOM 不在は UI 側の追加防御）。
- 認証は持たない（社内 LAN / トンネル時の認証は運用ガイド F-08 で注意喚起 — スコープ外）。
