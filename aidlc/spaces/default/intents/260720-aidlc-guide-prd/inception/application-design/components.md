# Components — AIDLC Guide

> ステージ: application-design (Inception 2.6) / 作成日: 2026-07-23 / lead: architect（aws-platform・design 観点内包）
> 入力: requirements.md（FR/NFR）+ stories.md（22US）+ team-practices.md（構造規約3点）
> 構成（Q1-A）: bun workspaces モノレポ、7パッケージ。「1ライブラリ・3サーフェス」（PRD §4）をパッケージ境界で物理化する。
> aws-platform 観点: 本ツールはローカル専用（project.md）。クラウドサービス・インフラは一切無し（コストゼロ）。全コンポーネントはローカルプロセス/ライブラリ。

## パッケージ / コンポーネント一覧

```
packages/
  shared-types/     … 型定義のみ（依存ゼロの最下層）
  reader-core/      … 状態モデルライブラリ（F-01、唯一の FS 読取層）
  docs-bridge/      … slug→docs 対応表 + 設定（F-05）
  mcp-server/       … MCP stdio サーバ（F-02）
  dashboard-server/ … ローカル bun サーバ（REST+WS+静的配信+Mob、F-04/F-07 の配信面）
  dashboard/        … Vite+React SPA（F-04/F-06/F-07 の表示面）
  btw/              … サイドセッション CLI（F-03）
docs/guides/        … 運用ガイド（F-08、コード外成果物）
```

## C1: shared-types

- **目的**: 全パッケージが共有する型定義（`WorkflowModel`, `StageStatus`, `MatrixCell`, `AuditEvent`, `ReadResult<T>` 判別可能ユニオン等）。
- **責務**: 型のみ。ランタイムコードを持たない（実行時依存ゼロ）。
- **境界**: どのパッケージからも import 可。逆依存なし。

## C2: reader-core（F-01 / US-09a・US-15）

- **目的**: aidlc ワークスペースの状態・成果物ツリー・監査ログを型付きモデルとして提供する唯一の読取層。
- **責務**: state パース（State Version 7 検知含む）/ 成果物ツリー走査 / 監査イベント抽出 / インテント解決 / ファイル監視（chokidar）/ 5失敗モードの fail-soft 表現。
- **内部構造（Q2-A・パーサ隔離）**:
  - `parse/` — State-Version 依存ロジックを**この中だけ**に隔離（team.md 規約2）
  - `tree/` — ユニット×ステージ×成果物マトリクス走査
  - `audit/` — 監査シャード抽出
  - `intents/` — active-intent カーソル解決・列挙
  - `watch/` — chokidar 監視→モデル再構築→通知
  - `index.ts` — 単一ファサード `createReader(rootPath)`
- **公開インターフェース**: `createReader(rootPath): Reader`。全読取メソッドは `ReadResult<T> = {ok:true,value:T} | {unsupported:true,version:string} | {error:true,reason:string}` を返す。**throw しない**（team.md 規約3）。
- **境界**: React / MCP SDK / HTTP / WebSocket を import しない純データ層（team.md 規約1）。FS アクセスは本パッケージのみが持つ。

## C3: docs-bridge（F-05 / US-23）

- **目的**: ステージ slug / 用語 → 公式 docs 該当節への静的対応表の単一所有者。
- **責務**: 対応表（データファイル）の所有・ロード / docs リポジトリパス設定の解決（FR-5.2）/ プロジェクト固有リンク設定（FR-5.3）/ 該当節本文の読取提供。
- **公開インターフェース**: `resolveStage(slug)` / `resolveTerm(term)` / `projectLinks()` — いずれも `ReadResult` 形。
- **境界**: reader-core と相互依存しない（対応表は静的データ + docs ファイル読取のみ）。MCP と Dashboard（server 経由）の両方が参照（FR-5.1 の cross-consumer 整合はここで担保）。

## C4: mcp-server（F-02 / US-09b）

- **目的**: 本線・サイドの Claude Code に aidlc 状態を提供する MCP stdio サーバ。
- **責務**: 5ツール（`aidlc_status` / `aidlc_explain_stage` / `aidlc_next_steps` / `aidlc_read_artifact` / `aidlc_glossary`）の公開。`read_artifact` の読取境界（正規化後に記録ルート配下のみ、3ベクタ拒否）。
- **境界**: reader-core + docs-bridge + shared-types を消費。書き込み API なし（読み取り専用）。

## C5: dashboard-server（F-04/F-07 配信面 / US-10・11・19、Q3/Q4-A）

- **目的**: ブラウザ SPA に reader-core のモデルを届けるローカル bun サーバ。Mob モードも同一実装。
- **責務**: 静的アセット配信（dashboard のビルド成果物）/ REST（初期スナップショット + 成果物本文）/ WebSocket push（reader-core の watch 通知を broadcast）/ 回答書込 API（`*-questions.md` の `[Answer]:` 行のみ、FR-6.2 の唯一の書込経路）/ bind 制御（既定 loopback、`--host` で LAN + 公開警告）/ 参加者モードの書込拒否（サーバ側、US-11）。
- **境界**: reader-core・docs-bridge を消費。書込は AnswerWriter モジュール1箇所に隔離（NFR-1）。

## C6: dashboard（F-04/F-06 表示面 / US-01〜05・13・14・16・18）

- **目的**: Vite+React SPA。refined-mockups の M-1〜M-4 を実装。
- **責務**: NowStrip / StageRail / UnitStageMatrix / DetailPanel（StageCard + NextStepCallout + ArtifactViewer + AnswerEditor）/ 参加者ビュー / 5状態表現 / 意味的トークン。
- **境界**: dashboard-server の REST/WS のみと通信（FS 直接アクセスなし）。reader-core を import しない（型は shared-types 経由）。Milkdown は ArtifactViewer 内に隔離（候補交代に備える — feasibility R-2）。

## C7: btw（F-03 / US-06〜08）

- **目的**: 読み取り専用サイドセッションを起動する CLI ラッパー。
- **責務**: `btw`（plan モード新ターミナル起動）/ `--fork`（最新セッション ID 解決 + fork）/ `-p`（ヘッドレス）/ help への fork 制約明記。OS 別 spawn（`process.platform` 分岐）。
- **境界**: Claude Code CLI の薄いラッパー。reader-core に依存しない（独立コンポーネント）。

## C8: 運用ガイド（F-08 / US-12・22、文書）

- **目的**: Live Share 運用ガイド + 非同期共有規約（コード外成果物）。`docs/guides/` に markdown で置く。
- **必須収録項目（本設計からの義務）**: Live Share ガイドの「モブ中の回答記入」節 — `--host` 中は Dashboard の回答記入が全クライアントで無効化される（ADR-04）ため、**モブ中の質問回答は「口頭合意 → ドライバーが本線セッション（または `--host` 停止後の Dashboard）で記入」**という運用手順を明記する。ADR-04 の受容したトレードオフの受け皿はこの節（トレーサビリティ: ADR-04 → C8）。

## UI コンポーネント構造（design 観点）

dashboard 内は refined-mockups の interaction-spec に従う: NowStrip / StatusChip / StatusLegend / StageRail / UnitStageMatrix / MatrixCell / DetailPanel（非モーダル）/ StageCard / NextStepCallout / ArtifactViewer / AnswerEditor / IntentPicker / ThemeToggle / ReadOnlyBadge / LiveStatus / EmptyState / UnparseableBadge。a11y プリミティブは Radix（FocusScope trapped=false / DismissableLayer / Select）のみ。

## 所有権まとめ

| データ/責務 | 所有 |
|------------|------|
| FS 読取 | reader-core のみ |
| slug→docs 対応表 | docs-bridge のみ |
| 唯一の書込（Answer 行） | dashboard-server の AnswerWriter のみ |
| ネットワーク bind 判断 | dashboard-server のみ |
| Milkdown 依存 | dashboard の ArtifactViewer のみ |

## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-23

- **Finding 1 (ADR-05 alternatives) — RESOLVED.** `decisions.md` ADR-05 now carries two genuine rejected alternatives with real trade-offs: (B) building the whole app Milkdown-first — deeper integration but spreads replacement cost across the app, contradicting the R-2 fallback policy; (C) a from-scratch markdown-it/remark renderer — zero replacement risk but abandons the WYSIWYG requirement (FR-6.1) before the M3 real-data validation the PRD §11 decision order calls for. Both are grounded in named artifacts (feasibility R-2, FR-6.1, PRD §11), not self-excusing filler. No hedging parenthetical remains.
- **Finding 2 (NFR-2 cold-start mechanism) — MECHANISM DESCRIBED, BUT CONTRADICTS component-methods.md.** `services.md` §スケーリング/性能特性 now describes the requested two-stage strategy: stage 1 (`GET /api/workflow`) parses only the single state file and resolves next-step, explicitly excluding the 593-file matrix scan; stage 2 builds the matrix/audit in the background and pushes the result over WS on completion. That text is correct and matches what was asked. However, `component-methods.md`'s `dashboard-server` endpoint table still lists `GET /api/workflow` as returning "初期スナップショット（WorkflowModel + Matrix + NextStep）" — i.e. the Matrix included in the very first response. That is the pre-fix, single-shot contract this finding was raised against, and it directly contradicts services.md's stage-1 description (which says the same endpoint's response has "593ファイル走査を含まない"). The WS message shape (`{type:"change", scope, snapshot差分}`) also only describes incremental diffs against a prior snapshot, with no distinct message for "background matrix build complete" — consistent with the stale single-shot reading in component-methods.md, not with the staged design in services.md. A developer building strictly from component-methods.md's endpoint table would implement the full-scan-on-first-call behavior NFR-2 was designed to avoid. This is a live, checkable contradiction between two of the five artifacts under review, not a stylistic nit — it must be fixed (either shrink `GET /api/workflow`'s documented payload to WorkflowModel+NextStep and add the matrix's WS delivery contract, or reconcile services.md to match).
- **Finding 3 (build-order contract) — RESOLVED.** `component-dependency.md` now specifies the dashboard→dashboard-server build contract: artifact location (`packages/dashboard/dist/`), script ordering (`build:dashboard && start:server` as a single root script), and missing-dist behavior (server fails at startup with a "run build first" message rather than serving a blank page). The Mermaid diagram now shows a distinct build-time edge (`DASH -->|build-time: dist/ assets| DS`) separate from the runtime edge (`DS -.runtime: HTTP/WS.-> DASH`), and the text fallback calls out that the two edges are different kinds (build-order dependency vs. data delivery).
- **Finding 4 (ADR-04 workaround traceability) — RESOLVED.** `components.md` C8 now carries a "必須収録項目" obligating the Live Share guide's「モブ中の回答記入」section to document the driver-can't-write-during-`--host` workaround, and explicitly back-references ADR-04. ADR-04 in `decisions.md` in turn names C8 as the mandated destination for that workaround. The traceability is bidirectional and concrete (not just "see operations guide").
- **Regression.** Dependency matrix, Mermaid graph, and text fallback in `component-dependency.md` agree with `components.md`'s stated boundaries (one-way deps, no dashboard→reader-core, no docs-bridge→reader-core). Parser isolation (`parse/` only) and the typed `ReadResult` union are described consistently across `components.md`, `component-methods.md`, and `decisions.md` ADR-02. The one regression found is the Finding 2 contradiction above, introduced by editing services.md without updating the corresponding endpoint row in component-methods.md.

**Disposition:** 3 of 4 findings resolved cleanly. Finding 2's fix is real but incomplete — it created a cross-artifact contradiction on the exact endpoint the fix targets. Resolve the `GET /api/workflow` payload description in `component-methods.md` (and, if needed, the WS message contract for the async matrix push) to match `services.md`'s staged design, then this stage is READY.


### Post-review resolution (lead, 2026-07-23)
レビューのイテレーション上限（2/2）到達後、残余の Finding 2 の派生矛盾（component-methods.md の `GET /api/workflow` が単発全載せ契約のままで services.md の段階的初回描画と矛盾）を、レビュアー指定どおり修正: `/api/workflow` は WorkflowModel + NextStep のみ（Matrix 非含有）、`/api/matrix` を新設、WS に `matrix-ready` メッセージを追加し、5成果物の契約を段階的初回描画（NFR-2 機構）で統一。Findings 1/3/4 はイテレーション2で解決済み。→ 全4件解決。
