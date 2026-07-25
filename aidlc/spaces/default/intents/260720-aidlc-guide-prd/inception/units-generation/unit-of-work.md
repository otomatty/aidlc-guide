# Units of Work — AIDLC Guide

> ステージ: units-generation (Inception 2.7) / 作成日: 2026-07-23 / lead: architect + delivery support
> 入力: application-design（components.md / component-methods.md / services.md / component-dependency.md / decisions.md）+ requirements.md + stories.md
> 方針（承認済みプラン）: パッケージ整合（Q1）/ shared-types は reader-core に同梱（Q2）/ artifact-viewer 独立（Q3）/ mob-mode 独立（Q4）。9 Unit。
> 注: 本ステージはトポロジーのみ。実装順・クリティカルパスは delivery-planning (2.8) が決める。

## U1: reader-core（kind: library / サイズ: L）

- **境界**: `packages/shared-types` + `packages/reader-core`（Q2: 型は reader と同時に生まれるため同梱）。
- **責務**: 型定義一式 + createReader ファサード（state パース [State Version 7 検知] / 成果物ツリー走査 / 監査抽出 / インテント解決 / chokidar watch / 5失敗モード fail-soft）。components.md C1+C2 の全実装。
- **配備モデル**: ライブラリ（standalone 実行なし。mcp-server / dashboard-server に embed）。
- **制約/ノート**: React・MCP SDK・HTTP を import 禁止（一方向依存の型検査を含む — component-dependency.md）。パーサは `parse/` に隔離。全境界は ReadResult（throw 禁止）。tb-lxp ゴールデン + ブランチカバレッジ重視（team.md）。

## U2: docs-bridge（kind: library / サイズ: S）

- **境界**: `packages/docs-bridge`。
- **責務**: slug→docs 対応表の単一所有 / resolveStage / resolveTerm / projectLinks / 設定ロード（components.md C3）。
- **配備モデル**: ライブラリ（mcp-server / dashboard-server に embed）。
- **制約/ノート**: reader-core の**実装**とは相互依存しない（components.md C3）が、Unit 粒度では shared-types（Q2 で reader-core Unit に同梱）の**型契約のみ**に依存する — unit-of-work-dependency.md のエッジ注記参照。対応表は静的データファイル。

## U3: btw（kind: service / サイズ: S）

- **境界**: `packages/btw`（CLI 実行体）。
- **責務**: plan モードサイドセッション起動 / --fork（セッションID解決）/ -p ヘッドレス / help に fork 制約明記（components.md C7）。
- **配備モデル**: standalone CLI（bun 実行）。
- **制約/ノート**: 他 Unit に依存しない完全独立。OS 別 spawn（process.platform、path.sep 決め打ち禁止）。

## U4: mcp-server（kind: service / サイズ: M）

- **境界**: `packages/mcp-server`。
- **責務**: MCP stdio サーバ、5ツール公開、read_artifact の3ベクタ読取境界（components.md C4 / component-methods.md）。
- **配備モデル**: standalone プロセス（Claude Code が .mcp.json 経由で spawn — services.md S1）。
- **制約/ノート**: explain_stage / glossary は docs-bridge 依存。書込 API なし。

## U5: dashboard-server（kind: service / サイズ: M）

- **境界**: `packages/dashboard-server`。
- **責務**: REST（段階的初回描画: /api/workflow は state 1枚のみ、/api/matrix は背景構築）/ WS push（matrix-ready + change）/ 静的配信（dashboard の dist/）/ AnswerWriter（唯一の書込）/ bind 制御（既定 loopback）（components.md C5 / services.md S2 / ADR-03）。
- **配備モデル**: standalone プロセス（ユーザー手動起動）。
- **制約/ノート**: dist/ 不在時は起動エラー案内（component-dependency.md ビルド時契約）。--host 系の挙動は U8 mob-mode が拡張。

## U6: dashboard-ui（kind: ui / サイズ: L）

- **境界**: `packages/dashboard` のうちビューア以外（NowStrip / StatusChip / StageRail / UnitStageMatrix / DetailPanel / StageCard / NextStepCallout / IntentPicker / ThemeToggle / EmptyState / UnparseableBadge / トークン・テーマ）。
- **責務**: refined-mockups M-1 / M-2a / M-4 の実装。5状態表現・色+記号+ラベル三重表現・a11y チェックリスト準拠。
- **配備モデル**: 静的アセット（U5 が配信）。
- **制約/ノート**: reader-core を import しない（HTTP/WS + shared-types 型のみ）。Radix は FocusScope/DismissableLayer/Select のみ。

## U7: artifact-viewer（kind: ui / サイズ: M）

- **境界**: `packages/dashboard` のうち ArtifactViewer + AnswerEditor（Q3: Milkdown リスクを1 Unit に隔離 — ADR-05）。
- **責務**: 冒頭に Milkdown 実データ検証（FR-6.1 の5項目チェックリスト、不合格なら候補交代）→ WYSIWYG 表示 + Mermaid + `[Answer]:` 行編集（byte-invariance）。refined-mockups M-2b。
- **配備モデル**: dashboard-ui と同一バンドル内のコンポーネント群。
- **制約/ノート**: Milkdown 依存はこの Unit のみ。エディタへ渡すデータ契約をテスト対象にする（team.md）。answer-editing は同 Unit 内の後続作業（閲覧 > 記入 — scope Q4）。

## U8: mob-mode（kind: service / サイズ: M）

- **境界**: U5/U6 への横断的拡張（Q4: LAN 公開・警告・参加者 read-only を一体検証）。`--host` フラグ経路 + 参加者ビュー差分。
- **責務**: --host bind + 公開警告（US-19）/ WS broadcast の参加者配信（US-10）/ サーバ側書込 403 + 編集UI DOM 不在（US-11）/ ReadOnlyBadge・LiveStatus（refined-mockups M-3）。
- **配備モデル**: U5 と同一プロセスの動作モード（ADR-04: 別サーバにしない）。
- **制約/ノート**: 既定 loopback は U5 で実装済みの前提。本 Unit は公開系の差分に集中。`kind: service` は「サーバ挙動（bind/broadcast/403）が作業の重心」を表す分類であり、独立デプロイ体を意味しない（配備は ADR-04 のとおり U5 のモード。矛盾ではなく kind は設計成果物マトリクスの選択キー）。

## U9: ops-guides（kind: spec / サイズ: S）

- **境界**: `docs/guides/`（コード外文書 — components.md C8）。
- **責務**: Live Share 運用ガイド（autoShareTerminals・**「モブ中の回答記入」節 = ADR-04 トレードオフの受け皿**・トンネル認証注意）+ 非同期共有規約（gate 時 push フック + checkout 不要閲覧）。
- **配備モデル**: 文書（実行体なし）。
- **制約/ノート**: mob-mode の実挙動（警告文言・--host 制約・ADR-04 節）を参照して書くため U8 に依存 — ただしこの依存は **Live Share ガイド（US-12）側のみ**に効く。非同期共有規約（US-22）は git 手順のみで U8 と無関係（stories.md どおり依存なし）。Unit 全体のエッジは保守的に U8 依存としつつ、2.8 は US-22 半分の先行着手を economic-sequencing で選んでよい。

## サイズ集計

| サイズ | Unit |
|--------|------|
| L | reader-core, dashboard-ui |
| M | mcp-server, dashboard-server, artifact-viewer, mob-mode |
| S | docs-bridge, btw, ops-guides |

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-23

- **docs-bridge edge (blocking, iteration 1) — resolved.** yaml now carries `docs-bridge: depends_on: [reader-core]`; unit-of-work-dependency.md's エッジ注記 narrows it to the Q2-lifted type-contract-only interface and flags it as economic-sequencing material for 2.8 without deciding an order; U2's note in unit-of-work.md matches (no lingering "no dependency" claim); the 並行開発の機会 bullet is narrowed to "型契約後並行" accordingly.
- **build-time edge (blocking, iteration 1) — resolved.** dashboard-ui→dashboard-server build-time prerequisite (`dist/` before server start) is now in the エッジ注記, the Mermaid dashed `UI -.build-time: dist/ 前提.-> DS` edge, and U5's note, with an explicit false-cycle rationale for keeping it out of the `depends_on` yaml.
- **mob-mode kind note (non-blocking) — resolved.** U8's note clarifies `kind: service` is a design-artifact-matrix key describing where design weight sits, not a separate deployable, and reconciles with ADR-04 (deployment stays U5's mode).
- **ops-guides dependency nuance (non-blocking) — resolved.** U9's note states the U8 edge binds only the US-12 (Live Share) half; US-22 (async-sharing) is git-only and independent per stories.md; the Unit-level edge stays conservatively U8-dependent while flagging the split as a 2.8 economic-sequencing option.
- **Regression** — yaml is well-formed and cycle-free (traced full topo order; new docs-bridge→reader-core edge runs the same direction as the rest of the graph, no cycle closes back). All 9 yaml unit names match the 9 `## U` headings 1:1; every heading's `kind:` matches its yaml `kind`. No economic-sequencing decisions leaked in — all "2.8 may choose..." phrasing stays optional, and the story-map's "Unit 内実装順" is intra-unit technical ordering, consistent with its own "Bolt 順は 2.8" disclaimer.

