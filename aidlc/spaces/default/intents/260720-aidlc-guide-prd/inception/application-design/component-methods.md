# Component Methods — AIDLC Guide

> ステージ: application-design (Inception 2.6) / 作成日: 2026-07-23
> 入力: components.md + requirements.md + stories.md + team-practices.md
> 公開 API の署名と目的。詳細な業務ルールは Functional Design で。エラー処理は全読取境界で `ReadResult<T>` 判別可能ユニオン（throw しない — team.md 規約3）。

## 共通型（shared-types）

```ts
type ReadResult<T> =
  | { ok: true; value: T }
  | { unsupported: true; version: string }   // State Version 不一致（C-T3）
  | { error: true; reason: string };         // 欠落・破損・読取不能（fail-soft）

type StageStatus = "not-started" | "in-progress" | "awaiting-approval" | "revising" | "completed" | "skipped";
type Verdict = "READY" | "NOT-READY" | null;
```

## reader-core（`createReader(rootPath): Reader`）

| メソッド | 署名（概略） | 目的 / エラー処理 |
|---------|-------------|------------------|
| `getWorkflow()` | `() => ReadResult<WorkflowModel>` | state パース（FR-1.1）。phase/currentStage/stages[]/scope/depth/done/total/gate。Version 不一致は `unsupported` |
| `getMatrix()` | `() => ReadResult<Matrix>` | ユニット×ステージ×成果物走査（FR-1.2）。セル単位の欠落は cell 内 `error` で局所化（FR-1.6④） |
| `getAuditEvents(limit)` | `(limit: number) => ReadResult<AuditEvent[]>` | 監査シャード抽出（FR-1.3）。シャード読取不能は `error`（FR-1.6⑤） |
| `getIntents()` | `() => ReadResult<IntentList>` | active-intent 解決 + 列挙（FR-1.4）。カーソル無効は `value.active=null` + 全列挙（FR-1.6①②） |
| `getNextStep()` | `() => ReadResult<NextStep>` | 次 in-scope ステージ + 人間に求められること（FR-2.3 / US-02 NextStepCallout のデータ源） |
| `readArtifact(relPath)` | `(p: string) => ReadResult<string>` | 記録配下の成果物本文。正規化後に記録ルート外なら `error`（3ベクタ拒否は呼出側 mcp/dashboard-server でも二重に検査） |
| `watch(onChange)` | `(cb: (e: ChangeEvent) => void) => () => void` | chokidar 監視→再構築→通知（FR-1.5）。戻り値は dispose |

## docs-bridge

| メソッド | 署名 | 目的 |
|---------|------|------|
| `resolveStage(slug)` | `(slug: string) => ReadResult<StageDoc>` | 目的/入出力/担当/ゲート要求 + docs 該当節（FR-2.2/FR-4.4）。未知 slug は `error("not-found")` |
| `resolveTerm(term)` | `(term: string) => ReadResult<TermDoc>` | 用語定義（FR-2.5）。未知は `error("undefined-term")` |
| `projectLinks()` | `() => ReadResult<Link[]>` | PRD/ADR/practices リンク（FR-5.3） |
| `loadConfig(path?)` | `(p?: string) => ReadResult<BridgeConfig>` | docs clone パス等の設定（FR-5.2） |

## mcp-server（MCP tools）

| ツール | 入力 → 出力 | 実体 |
|--------|------------|------|
| `aidlc_status` | `{} → WorkflowModel要約` | `reader.getWorkflow()`（FR-2.1） |
| `aidlc_explain_stage` | `{slug} → StageDoc` | `docsBridge.resolveStage()`（FR-2.2） |
| `aidlc_next_steps` | `{} → NextStep` | `reader.getNextStep()`（FR-2.3） |
| `aidlc_read_artifact` | `{path} → string` | 3ベクタ検査 → `reader.readArtifact()`（FR-2.4） |
| `aidlc_glossary` | `{term} → TermDoc` | `docsBridge.resolveTerm()`（FR-2.5） |

エラー処理: `ReadResult` を MCP のエラー/コンテンツ形式へマップ（`unsupported`→明示メッセージ「State Version 非対応」、`error`→理由文字列）。

## dashboard-server（HTTP/WS API）

| エンドポイント | 目的 |
|---------------|------|
| `GET /api/workflow` | **第1段（first paint 経路・NFR-2）**: WorkflowModel + NextStep のみ返す（state ファイル1枚のパース + next-step 解決。**Matrix を含まない** — 593ファイル走査は初回応答のクリティカルパス外。services.md 段階的初回描画の第1段） |
| `GET /api/matrix` | Matrix（FR-1.2 全走査の結果）。第2段の背景構築完了後に有効。構築中は `{building:true}` を返し、完了は WS `matrix-ready` で通知 |
| `GET /api/artifact?path=` | 成果物本文（読取境界検査つき） |
| `GET /api/stage/:slug` | StageDoc（docs-bridge 経由） |
| `POST /api/answer` | **唯一の書込**: `{file, line, value}` — `*-questions.md` の `[Answer]:` 行のみ。パターン不一致/参加者モードは 403（FR-6.2/US-11/US-14） |
| `WS /ws` | push チャネル。メッセージ種別: `{type:"matrix-ready", matrix}`（第2段の背景構築完了 — services.md 第2段）/ `{type:"change", scope, snapshot差分}`（`reader.watch()` の変更通知 broadcast、FR-7.2） |
| 起動オプション | `--port`（既定固定）/ `--host`（LAN、公開警告出力 — US-19）/ `--participant-only`（保険。通常は接続元で判定しない: 全クライアント同一、書込可否は起動モードで決める） |

エラー処理: `ReadResult` を HTTP ステータス + 本文（`unsupported`→200 + 解析不可ペイロード、要求不正→4xx）にマップ。**サーバは reader の error を 500 にしない**（fail-soft の UI 表現に渡す — NFR-6）。

## btw（CLI）

| コマンド | 動作 |
|---------|------|
| `btw` | plan モードの Claude Code を新ターミナル起動（OS別 spawn: `process.platform` 分岐、US-06） |
| `btw --fork` | `~/.claude` 配下から最新セッション ID を解決し fork 起動（FR-3.2）。解決不能時はエラーメッセージ + `/branch` 案内 |
| `btw -p "<q>"` | ヘッドレス実行、stdout に回答（FR-3.3） |
| `btw --help` | fork の JSONL フラッシュ制約 + `/branch` 第一案内を明記（FR-3.4） |

## dashboard（UI 層）

コンポーネント props は shared-types の型を受けるのみ（interaction-spec.md の C-1〜C-4 参照）。API クライアントは `GET /api/*` + WS 購読の薄い層（`services/api.ts`）1箇所に隔離。
