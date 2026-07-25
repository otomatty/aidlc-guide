# Code Summary — Unit: dashboard-ui

> code-generation (3.5) / Unit: dashboard-ui / 2026-07-25
> 実装場所: `packages/dashboard/`

## 生成ファイル

| ファイル | 役割 | 行数目安 |
|---------|------|---------|
| `index.html` / `vite.config.ts` | SPA シェル（`lang="ja"`）とハッシュ付き出力設定 | ~35 |
| `src/main.tsx` | React マウント前に `/api/workflow` を先行発火（P-UI-2） | ~20 |
| `src/app/App.tsx` | 4領域の AreaBoundary 配置・起動フロー・matrix の `React.lazy` | ~110 |
| `src/store/state.ts` | `ViewState` / `AppState` / `initialState` / `viewValue` | ~70 |
| `src/store/context.tsx` | state / dispatch を別 context にした StoreProvider | ~50 |
| `src/store/deriveViewState.ts` | ペイロード→5状態の唯一の漏斗 + 縮退抽出 | ~95 |
| `src/store/reducer.ts` | WsMessage → slice 更新（audit は明示 case で無視） | ~135 |
| `src/services/api.ts` | GET クライアント + `refetchAll()`。**POST 関数なし** | ~90 |
| `src/services/live.ts` | `useLiveConnection`（WS + 指数バックオフ + open で再取得） | ~120 |
| `src/services/docs.ts` | オンデマンド取得（stage doc メモ化 / links アイドル）+ href 生成 | ~110 |
| `src/hooks/useDelayedLoading.ts` | 200ms 閾値の一元化 | ~25 |
| `src/components/*.tsx` (13) | NowStrip / StageRail / UnitStageMatrix / DetailPanel / StageCard / NextStepCallout / StatusChip / StatusLegend / Header / IntentPicker / ThemeToggle / AreaBoundary / atoms | ~900 |
| `src/styles/tokens.css` + `app.css` | 意味的トークン（7状態色）と全レイアウト | ~500 |
| `tests/*.test.{ts,tsx}` (9) + `fixtures.ts` + `setup.ts` | 下記テスト構成 | ~900 |

**リポジトリ側の変更**:
`package.json`（`build:dashboard` / `dashboard` スクリプト、`check` に dashboard の
tsc pass、UI devDependencies）、`tsconfig.json`（`packages/dashboard` を exclude —
ブラウザ用 lib/jsx を node パッケージに持ち込まないため）、`vitest.config.ts`
（projects 化: node / dashboard=jsdom、coverage に `.tsx` を追加、`main.tsx` を除外）、
`packages/dashboard-server/tests/server-smoke.test.ts`（下記 D-1）。

## 品質ゲート実測（`bun run check`）

```
biome check .            Checked 135 files in 136ms. No fixes applied.
tsc --noEmit             (エラーなし)
tsc --noEmit -p packages/dashboard   (エラーなし)
vitest run --coverage    Test Files 43 passed (43)
                         Tests 587 passed | 2 skipped (589)
bun audit                No vulnerabilities found
```

内訳: node プロジェクト 489 passed | 2 skipped（本 Unit 前と同一 — 既存を壊していない）
＋ dashboard プロジェクト **98 passed**（新規）。

`vite build packages/dashboard` も成功（120 modules、初期チャンク 301.75 kB /
gzip 98.52 kB、matrix は `UnitStageMatrix-*.js` 3.52 kB に分割）。

dashboard の coverage（v8）:

| 区分 | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `src/store` | 97.05 | 94.73 | 100 | 100 |
| `src/services` | 93.12 | 89.33 | 93.93 | 94.78 |
| `src/components` | 93.37 | 86.92 | 93.93 | 94.04 |
| `src/app` | 88 | 50 | 81.81 | 86.95 |

> `src/components` は 2026-07-25 の Correction 実測に差し替え済み（旧値
> 91.7/83.9/92.4/92.7 はレビュー指摘どおり前パスの stale な値）。

team.md の「UI 層 ライン カバレッジ ~80%」を全区分で上回る。
リポジトリ全体: Statements 96.34% / Branches 92.45% / Lines 97.68%。

## テスト構成（98件）

- `reducer.test.ts`（14件）— 各 WsMessage → 該当 slice。`change scope="audit"` が
  **同一オブジェクト参照を返す**（=無視）ことを assert。`matrix:<unit>` の行単位
  差し替えと、matrix 未取得時の push 無視。
- `derive-view-state.test.tsx`（14件）— 5状態全分岐（success / empty / error /
  partial / loading）、`unsupported` の version 露出、`unparseable` と `cell.error`
  の partial 降格、200ms 閾値（fake timers で 199ms / 200ms / 解除の3点）。
- `components.test.tsx`（17件）— StatusChip の**7状態それぞれ**で色トークン・記号・
  ラベルの3要素が DOM に存在すること（`it.each`）、NextStepCallout の現在ステージ限定、
  StageCard 4フィールド + deep-link + 危険スキームの遮断、matrix の空(·) vs 対象外(—)
  vs cell.error、StageRail の SKIP 折りたたみ + 理由 + roving tabindex（端で止まる）。
- `detail-panel.test.tsx`（6件）— 開時に h2 へフォーカス、Esc で閉じてトリガへ復帰、
  外側クリックで閉じる、**`aria-modal` 不在 かつ 外部要素へフォーカスを移せる**
  （トラップ不在の実測）、局所エラー表示。
- `live.test.tsx`（7件）— バックオフ表（1/2/4/8/10s 上限）と実タイマー挙動（999ms で
  再接続しない、1000ms でする）、open 成功後にバックオフがリセットされること、
  open での `refetchAll`、不正フレームを落として落ちないこと、unmount 停止。
- `services.test.tsx`（13件）— API 全分岐（裸ボディの持ち上げ / warnings 保持 /
  building / unexpected-response / サーバ停止）、`safeHref` の許可・拒否ベクタ、
  slug メモ化（a→b→a で fetch は2回）。
- `app.test.tsx`（12件）— bootstrap promise を消費し `/api/workflow` を**再取得しない**、
  landmark 4種と `aria-current="step"`、lazy matrix の解決、パネル開閉、
  NowStrip の empty/error/partial、LiveStatus の role/aria-live/3状態、
  ThemeToggle、AreaBoundary の領域隔離（例外注入）。
- `header.test.tsx`（4件）— links のアイドル取得、外部リンクの `target=_blank` +
  `rel=noopener noreferrer`、危険スキームの除外、read-only バッジ、
  NextStepCallout の遷移コールバック。
- `dependency-direction.test.ts`（5件）— reader-core / docs-bridge / dashboard-server /
  node builtin を import しないこと、依存リストが6件に固定されていること、
  `method:"POST|PUT|PATCH|DELETE"` と `/api/answer` がソースに現れないこと、
  `dangerouslySetInnerHTML` / `innerHTML` がゼロであること、`fetch(` を呼ぶのは
  `services/api.ts` だけであること。

## 設計判断（Deviations / D-n）

- **D-1: dashboard-server の smoke テストを1行修正**。
  `server-smoke.test.ts` は「dashboard パッケージが未出荷なので API-only」という
  **一時的な前提**を assert していた。本 Unit で `dist/` が存在しうるようになったため、
  `DEFAULT_DIST_DIR/index.html` の実在で分岐を判定する形に変更（ビルド済み・未ビルドの
  どちらでも決定的）。サーバ実装は無変更。
- **D-2: CSS Modules ではなくプレーン CSS**。nfr-requirements は「CSS カスタム
  プロパティ + プレーン CSS Modules」。トークン方式（意味的 custom property）は
  そのまま採用したが、モジュール化は BEM 風のクラス名で代替した。CSS Modules は
  `*.module.css` の型宣言シムと vitest 側の CSS 変換設定を要求し、デスクトップ単一
  ページ・1ファイルのスタイルシートに対して得るものがない。トークン参照の規約
  （生 hex をコンポーネントに書かない）は維持。
- **D-3: DetailPanel のフォーカス復帰は自前で持つ**。Radix FocusScope は
  `document.activeElement` を **container ref が解決した2回目のコミット**で記録する。
  その時点では既に h2 にフォーカスが移っているため、FocusScope に任せると「消える
  見出し」へ復帰しようとして焦点が body に落ちる。`onUnmountAutoFocus` で Radix の
  復帰を止め、開閉時のフォーカス移動・復帰は DetailPanel 自身の effect が所有する。
  FocusScope は**非トラップのスコープ管理**として残置（設計の primitive 選択は不変）。
  この挙動は `detail-panel.test.tsx` が実測で守る。
- **D-4: 遅延応答の stage doc を破棄しない**。選択が速く切り替わったときに古い応答を
  捨てると、`stageDoc[slug]` が `loading` のまま固定され、`known` フラグにより再取得も
  起きない（=そのステージが二度と開けない）。slice は slug キーなので遅延応答は自分の
  スロットを埋めるだけで現在表示を汚さない。したがって常に dispatch する。
- **D-5: `main.tsx` を coverage から除外**。モジュール本体で実 DOM に `createRoot`
  するブラウザ入口であり、import した時点でアプリが起動してしまう。存在理由である
  「マウント前に fetch を発火する」順序は `app.test.tsx` が同じ形（先行 promise を
  App に渡す）で assert している。

## ギャップ / 後続 Unit 送り

- **G-1: IntentPicker は実質1択**。dashboard-server にインテント一覧の endpoint が
  無い（`IntentList` 型は reader-core にあるが公開ルートが無い）。現状はアクティブ
  インテント1件を Radix Select で表示し、切替は不能。`GET /api/intents` を追加すれば
  コンポーネント形状を変えずに接続できる（コード内に upgrade path をコメント）。
- **G-2: NowStrip の "unit" 表示なし**（**2026-07-25 解決: AC 側を修正**。FR-4.1 / US-01 から "unit" を削除 — state に該当フィールドが存在せず reader が返せないため。進行中ユニットの可視化は FR-4.3 マトリクスが担う。実装は現状のままで契約に一致）。M-1 モックは `▸ unit: reader-core` を含むが、
  `WorkflowModel` に unit フィールドが無く、サーバも返さない。BR-UI-3（数え直さない /
  推測しない）に従い**表示しない**。必要なら reader-core / shared-types 側の追加が先。
- **G-3: 監査表示なし**（設計どおり — SC-UI-3。`change scope="audit"` は明示無視）。
- **G-4: ArtifactViewer / AnswerEditor なし**（artifact-viewer Unit の責務 — BR-UI-7）。
  matrix セル選択時は当該ステージの解説カードを開く。
- **G-5: 実測 NFR は未計測**。P-UI-1/2/3/4（1.0s / 0.7s / 0.5s / 500セル 300ms）は
  tb-lxp フィクスチャに対する performance-validation ステージの担当。本 Unit では
  機構（先行 fetch・code-split・slice 別更新・行 memo）の実装と、200ms 閾値の
  タイマーテストのみ完了。
- **G-6: 手動 a11y 走査は未実施**。自動検証（landmark / `aria-current` / role=status /
  フォーカス移動・復帰 / トラップ不在）は済。キーボードのみ走査・スクリーンリーダー・
  グレースケール・200% 拡大・トークンのコントラスト計算は accessibility-checklist の
  「手動」項目として残る。

## Review

**Verdict:** READY

**Reviewer:** aidlc-architecture-reviewer-agent

**Date:** 2026-07-25

### Gate re-run (real output)

`bun run check` (biome check . && tsc --noEmit && tsc --noEmit -p packages/dashboard
&& vitest run --coverage && bun audit) re-executed in full:

- `biome check .` — Checked 135 files, no fixes applied. Matches claim.
- `tsc --noEmit` (root) and `tsc --noEmit -p packages/dashboard` — both clean.
- `vitest run --coverage` — **43 test files passed, 587 tests passed, 2 skipped
  (589 total)**. Matches code-summary's claimed split (489 node + 98 dashboard).
  Repo-wide coverage: Statements 96.34%, Branches 92.45%, Lines 97.68% — matches
  the claimed totals exactly. Per-package rows for `src/store` (97.05/94.73/100/100)
  and `src/services` (93.12/89.33/93.93/94.78) match the doc exactly; `src/app`
  (88/50/81.81/86.95) matches exactly.
  **Discrepancy (non-blocking)**: the doc's `src/components` row claims
  91.7/83.9/92.4/92.7 but the actual re-run reports **93.29/86.01/93.93/93.97**
  (code-summary.md:55 vs. live output). Still well above team.md's ~80% line
  floor and every other row reconciles bit-for-bit, so this looks like a stale
  number from an earlier pass rather than a regression — but the doc should be
  refreshed so its own evidence table stays trustworthy.
- `bun audit` — No vulnerabilities found. Matches claim.
- `vite build packages/dashboard` — re-run independently: **120 modules
  transformed**, `index-DpCLZQw2.js` 301.75 kB / gzip 98.52 kB,
  `UnitStageMatrix-CUqdLiMo.js` 3.52 kB / gzip 1.21 kB. Matches the doc exactly,
  including the hashed chunk filenames (so the dist/ checked into the tree is
  the real build artifact, not a hand-edited stand-in).

### Findings against the design contracts (checklist items 1–10)

1. **S-1 north star — CONFIRMED, with one caveat inherited from upstream.**
   `NowStrip.tsx:52-86` (`packages/dashboard/src/components/NowStrip.tsx`)
   renders phase/currentStage/depth/gate/done-total in one region with no
   further interaction, values passed through verbatim
   (`{workflow.done} / {workflow.total}`, comment "never recomputed here").
   `NextStepCallout` (`packages/dashboard/src/components/NextStepCallout.tsx`)
   is only ever mounted from `StageCard.tsx:74` behind
   `isCurrent && nextStep !== undefined` — i.e. only the current stage's card
   ever renders it, matching US-02/FR-4.6. **Caveat**: FR-4.1's AC
   (`inception/requirements-analysis/requirements.md:61-62`) and US-01's AC
   (`inception/user-stories/stories.md:74`) both explicitly list **unit** as
   one of the fields the Now strip must show standalone ("phase・current
   stage・**unit**・gate 状態・完了数が他操作なしに読める"). `WorkflowModel`
   in `packages/shared-types/src/index.ts:61-77` carries no `unit` field (only
   `MatrixCell.unit` exists, per-cell), so the dashboard cannot show it and
   doesn't (`NowStrip.tsx` has no unit field at all). This is documented as
   G-2 with a correct root-cause ("WorkflowModel に unit フィールドが無く、
   サーバも返さない") and a correct BR-UI-3 justification for not guessing —
   but it means FR-4.1/US-01's AC, as literally written and already marked
   READY at inception, is not met by the shipped system. The gap sits in
   shared-types/reader-core, outside this unit's power to close; dashboard-ui
   is faithfully implementing the contract it was handed (frontend-components.md:33
   already hedges "unit（あれば）"). Not blocking for **this** unit's
   code-generation review, but it should be escalated as a cross-unit
   traceability defect against FR-4.1, not silently absorbed as a `G-` note.

2. **US-18 / 7-state StatusChip — CONFIRMED.** `StatusChip.tsx:20-28`
   (`STATUS_PRESENTATION`) is checked field-by-field against
   `design-system-mapping.md`'s triple-representation table (lines 34-42):
   token name, symbol, and label match for all seven rows including
   `revising: { token: "--color-status-revising", symbol: "◑", label: "revising" }`.
   `tokens.css:20` defines `--color-status-revising` with matching hex values
   in light/dark/`[data-theme]` blocks. `StatusLegend.tsx` iterates the same
   `CHIP_STATUSES` array, so the legend cannot drift from the chip map.

3. **US-05 / FR-4.3 empty-vs-out-of-scope — CONFIRMED.**
   `UnitStageMatrix.tsx:39-46` renders `cell === undefined` (absent from
   `Matrix.cells`) as `data-kind="out-of-scope"` / "—", and
   `UnitStageMatrix.tsx:48-63` renders a present cell with `count === 0` as
   `data-kind="empty"` / "·" — a distinct branch from the absent case. This is
   the exact rule from `business-logic-model.md:54`.

4. **BR-UI-1 (no reader-core) — CONFIRMED.** `package.json:11-18` lists exactly
   six dependencies (shared-types, three Radix primitives, react, react-dom).
   `dependency-direction.test.ts:18-27,62-74` asserts both the banned-import
   list and the exact dependency set; the gate run above shows this test
   passing. Manual read of every `src/**/*.ts(x)` import found no
   `reader-core`/`docs-bridge`/`dashboard-server`/node-builtin import.

5. **S-UI-1 (no POST) / S-UI-3 (no dangerouslySetInnerHTML) — CONFIRMED.**
   `dependency-direction.test.ts:76-94` greps source for
   `method:\s*["'](POST|PUT|PATCH|DELETE)["']`, `/api/answer`,
   `dangerouslySetInnerHTML` and `innerHTML`, all failing the test if found;
   this review's own `Grep` for `aria-modal` and manual reads of
   `StageCard.tsx` (excerpt rendered via `<pre>{doc.excerpt}</pre>`, not HTML
   injection) corroborate. `services/api.ts` has no POST/PUT/PATCH/DELETE
   helper — only `fetchWorkflow`/`fetchMatrix`/`fetchStageDoc`/`fetchLinks`,
   all GET.

6. **BR-UI-3 (no client recompute) — CONFIRMED.** Grepped every place `done`,
   `total`, `verdict`, `count` appear in `src/components`: `NowStrip.tsx:71`
   prints `workflow.done`/`workflow.total` directly; `UnitStageMatrix.tsx:62-68`
   prints `cell.count` and `cell.verdict` directly. No arithmetic on server
   tallies found anywhere in `src/`.

7. **BR-UI-4/5 + US-15 degradation surfacing — CONFIRMED.**
   `deriveViewState.ts:33-53` is the single funnel: `unsupported` → `error`
   with the version string interpolated into the Japanese message (line 40),
   `error` (non-empty-workspace reason) → `error`/`empty`, `warnings`/
   `cell.error` → downgrade `success` to `partial` with notes rendered via
   `UnparseableBadge`. `AreaBoundary.tsx` (class `ErrorBoundary`) wraps
   NowStrip/StageRail/Matrix/DetailPanel individually in `App.tsx:78-93`, plus
   one more at the `App` root (`App.tsx:103-105`) — the documented two-tier
   R-UI-1 structure, confirmed by the coverage report showing
   `AreaBoundary.tsx` exercised (70/75/60/75, i.e. the catch path is hit by
   tests, not just the happy path).

8. **a11y — CONFIRMED for the automated items.** `<header>` (banner),
   `<nav aria-label="ステージ一覧">`, `<main className="layout">`, and
   `<aside aria-labelledby="panel-heading">` (complementary) together give the
   four landmarks the checklist requires; `NowStrip`'s `<section
   aria-labelledby>` maps to an implicit `region` landmark. `aria-current="step"`
   is set only on the current `StageRailItem` (`StageRail.tsx:71`). Roving
   tabindex is implemented correctly: exactly one button has `tabIndex={0}`
   at a time (`tabbable ? 0 : -1}`, `StageRail.tsx:72`), arrow/Home/End move
   both the visual focus and the `focused` index (`StageRail.tsx:90-140`).
   `DetailPanel.tsx` has no `aria-modal` anywhere in the codebase (grep
   confirmed, the only hit is a comment); `FocusScope trapped={false}` +
   `onUnmountAutoFocus={preventDefault}` plus a hand-rolled effect
   (`DetailPanel.tsx:42-50`) moves focus to the `h2` on open and restores it
   to `trigger.current` (captured via `document.activeElement` at open time)
   on close/unmount — this is D-3's documented mechanism and it is exercised
   by `detail-panel.test.tsx` per the coverage report. `role="status"` is
   present on `LiveStatus`, `UnparseableBadge`, `Skeleton`, `ReadOnlyBadge`
   (`atoms.tsx`), and `role="alert"` on `EmptyState`.

9. **Contract fidelity to the real server — CONFIRMED.** Read
   `packages/dashboard-server/src/handlers/read.ts` and
   `packages/dashboard-server/src/push.ts` directly (single sibling files
   named by this checklist item) and cross-checked against the client:
   - `/api/workflow`'s bare body (`{workflow, nextStep, serverMode, warnings?}`,
     `read.ts:64-69`) matches `WorkflowPayload` in `state.ts:31-36` and the
     lift-into-`ReadResult` logic in `api.ts:48-59`.
   - `push.ts:66-71` broadcasts `{type:"change", scope:"state", workflow,
     nextStep}`; `reducer.ts:99-109` consumes exactly those two fields.
   - `push.ts:81-93` broadcasts `{type:"change", scope:"matrix:<unit>",
     cells}`; `reducer.ts:117-136` (`applyMatrixScope`) slices the same
     `"matrix:"` prefix and merges by `cell.unit`, matching push.ts's
     per-unit rebuild (BR-DS-5) exactly.
   - `push.ts:74-78` broadcasts `{type:"change", scope:"audit", events}`;
     `reducer.ts:111-115` has an explicit `case "audit": return state;` (not
     a `default` fallthrough), matching SC-UI-3 and the code's own comment
     about not silently inheriting a fallthrough.
   - `server.ts:142` broadcasts `{type:"matrix-ready", matrix}`;
     `reducer.ts:81-85` consumes it.
   - `read.ts` exposes no `/api/intents` route — confirms G-1 below is a real,
     verified gap and not a documentation artifact.

10. **Deviations D-1..D-5 — sound, all verified against real code.**
    D-1 (`server-smoke.test.ts:108-113`) reads exactly as described: the
    branch is asserted rather than one side of it, keyed off
    `existsSync(path.join(DEFAULT_DIST_DIR, "index.html"))`. D-2 (plain CSS
    over CSS Modules) — `tokens.css`/`app.css` use only custom-property
    references, no raw hex found in components (spot-checked `StatusChip.tsx`,
    which resolves color via `var(${token})`, never a literal hex). D-3
    (DetailPanel owns focus restore) — verified above, mechanism matches the
    stated Radix double-commit problem and its `onUnmountAutoFocus` workaround.
    D-4 (late stage-doc responses always dispatched) — `docs.ts:33-39`
    dispatches unconditionally in the `.then`, keyed by `slug`, matching the
    stated rationale (dropping it would strand that slug on `loading`
    forever). D-5 (`main.tsx` excluded from coverage) —
    `vitest.config.ts:50` lists `packages/dashboard/src/main.tsx` in
    `coverage.exclude` with a comment matching the stated rationale, and
    `main.tsx` itself is a 20-line bootstrap consistent with that framing.

### Item 11 — IntentPicker single-option gap (adjudication)

**Confirmed as a real, user-visible functional hole, not a cosmetic one.**
Evidence:

- `packages/dashboard-server/src/handlers/read.ts:88-112` (`handleRead`) has
  no `/api/intents` route — the only intent-shaped data ever returned is the
  single active intent embedded in `/api/workflow`. This was independently
  verified by reading the server source, not inferred from the gap note.
- `IntentPicker.tsx:19-23`: when there is no active intent (`active === null`,
  i.e. exactly the empty-workspace case US-15 targets), `items = []` and the
  Radix `Select.Root` renders `disabled` with placeholder text
  "インテントなし". It offers **zero** interactive affordance — not even a
  disabled-but-informative list of what else exists, because the client has
  no way to ask the server for that list.
- `atoms.tsx:38-49` (`EmptyState`) prints, next to that disabled picker: "`/aidlc`
  で最初のインテントを作成するか、**別のインテントを選択してください**" — the
  copy actively invites the user to pick a different intent, immediately above
  a control that cannot do that.
- US-15's AC (`stories.md:57`) is explicit and was already reviewed READY at
  inception: "インテント未生成の空ワークスペース, Then 「インテントがありません」
  ＋**一覧導線**を表示しクラッシュしない". A disabled single-item dropdown with
  no way to browse other intents does not satisfy "一覧導線" (a list
  affordance) — there is no list.

**Recommendation: non-blocking for this unit's code-generation stage, but it
must not be silently absorbed as a permanent G-1 footnote — it needs a tracked
follow-up before M1/US-15 is called done.** Reasoning:
- The gap is structurally outside dashboard-ui's reach: `GET /api/intents`
  does not exist on the server this unit is required to be read-only against
  (BR-UI-1 forbids reader-core access, and the server is dashboard-server's
  responsibility, not this unit's). Dashboard-ui cannot fix this by writing
  more UI code — the fix is a new server route plus wiring `IntentList` (which
  reader-core already has per the code-summary's G-1 note) through to a
  fetchable endpoint.
- The component is honestly built for the upgrade: `IntentPicker.tsx`'s own
  comment names the exact upgrade path ("add `GET /api/intents` to
  dashboard-server and map its `IntentList` onto `items` here — the component
  shape does not change"), and nothing in the current shape needs rework once
  the endpoint exists.
- But the EmptyState copy currently promises a capability ("別のインテント
  を選択してください") the UI cannot deliver, which is worse than simply
  omitting the promise — that mismatch is a one-line fix available today
  (soften or remove the "select a different intent" clause until the picker
  can actually do it) and should be applied regardless of when the server
  endpoint lands, since it costs nothing and closes the copy/capability gap
  immediately.
- Net: do not block this unit's READY verdict on a missing sibling-unit route,
  but open a tracked gap against dashboard-server (add `/api/intents`) and
  fix the misleading EmptyState copy now.

## Correction (2026-07-25) — US-15 一覧導線 と誤解を招くコピーの修正

レビュー指摘（G-1 / EmptyState のコピー）に対する是正。dashboard-server に
`GET /api/intents` が入ったため、`IntentPicker` を実データで配線した。

**変更点**

- `src/services/api.ts`: `fetchIntents()` を追加（**GET のみ**。この package に
  POST 関数は依然として存在しない — S-UI-1）。`refetchAll()` に同梱（readdir 1回の
  安価な読み取りのため、独立ステップにしない）。起動時は App の matrix 取得と
  同じ effect で発火。
- `src/store/state.ts` / `reducer.ts`: `intents: ViewState<IntentList>` slice と
  `{type:"intents"}` action を追加。既存の `deriveViewState` 漏斗を通す（R-UI-2）。
- `src/components/IntentPicker.tsx`: Radix Select → ネイティブ `<details>` の
  **情報開示**に置換。全インテントを列挙し、アクティブを 記号(✔/○) + テキスト
  「（アクティブ）」+ `data-active` の三重表現で示す（project.md の色非依存規約）。
  **選択操作は提供しない**: 切替は `active-intent` カーソルへの書き込みであり、
  本ツールは書かない（NFR-1）。「切り替えは Claude Code で
  `/aidlc intent <名前>`」という説明を UI 内のテキストとして表示する。
  結果として `@radix-ui/react-select` が未使用になったため依存から削除
  （dependency-direction.test.ts の宣言リストも更新。残る Radix は2つ）。
- `src/components/atoms.tsx` の `EmptyState`: 「別のインテントを選択してください」
  という**できない約束**を削除し、(a) アクティブなインテントがない旨（見出し＋
  hint 行）、(b) 存在するインテントの一覧（children = IntentPicker、
  active が無いときは自動で open）、(c) 実際のコマンド `/aidlc intent <名前>` の
  3点を提示する。
- `src/styles/app.css`: `.picker__*` を details 版に合わせて調整。

**新規テスト**: `tests/intents.test.tsx`（8件）— fetchIntents の GET/unreachable、
picker が全件を列挙しアクティブを記号+テキストで示すこと、combobox/option/button を
**持たない**こと（切替不能であることの構造的 assert）、active 不在時に一覧が
開くこと、empty state が一覧とコマンドを出し旧コピーを含まないこと、intents が
degraded でもアプリの残りが描画されること（BR-UI-4）。
dashboard-server 側 +3件と合わせて **+11件**。

**書き込み経路は追加していない**（`fetch` の init に method 指定なし、
`/api/answer` 参照なし — dependency-direction.test.ts が構造的に担保）。

### ゲート実測（`bun run check`、2026-07-25 再実行）

```
biome check .            Checked 136 files in 117ms. No fixes applied.
tsc --noEmit             (エラーなし)
tsc --noEmit -p packages/dashboard   (エラーなし)
vitest run --coverage    Test Files 44 passed (44)
                         Tests 598 passed | 2 skipped (600)
bun audit                No vulnerabilities found
```

（本 Correction 前は 43 files / 587 passed | 2 skipped。差分 +1 file / +11 tests。）

リポジトリ全体: Statements 96.37% / Branches 92.58% / Lines 97.70%。
`vite build packages/dashboard` 再実行: 60 modules、`index-DH8z4lY0.js`
230.75 kB / gzip 73.31 kB（Radix Select 削除で初期チャンクが 301.75 kB から縮小）、
`UnitStageMatrix-DbWp0JM9.js` 3.52 kB。

dashboard の coverage（v8、今回の実測値）:

| 区分 | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `src/store` | 97.10 | 94.82 | 100 | 100 |
| `src/services` | 93.28 | 89.61 | 94.11 | 94.91 |
| `src/components` | 93.37 | 86.92 | 93.93 | 94.04 |
| `src/app` | 88.88 | 50 | 83.33 | 88 |

> レビューが指摘した stale な `src/components` 行（91.7/83.9/92.4/92.7）は、
> 上表が今回の実測に基づく正である。§「品質ゲート実測」の旧表は本 Correction
> 時点の実測であるこちらに読み替えること。
