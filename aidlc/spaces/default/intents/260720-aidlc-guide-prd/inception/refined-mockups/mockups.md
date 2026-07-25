# Refined Mockups — AIDLC Guide

> ステージ: refined-mockups (Inception 2.5) / 作成日: 2026-07-23 / lead: design + product support
> 入力: wireframes.md / user-flow.md（rough-mockups）+ stories.md（22US）+ requirements.md（FR/NFR）+ team-practices.md
> 中〜高忠実度。rough-mockups の構造を踏襲し、各画面に **5状態（loading/empty/error/partial/success）** と意味的トークン参照を加える（Q2/Q3）。忠実度: 中〜高（レイアウト・状態・トークンを確定。ピクセル最終値は実装で微調整）。

## 画面インベントリ（user story トレース）

| 画面 | 由来US | 主要コンポーネント |
|------|-------|------------------|
| M-1 Dashboard | US-01/02/05/16/18 | NowStrip, StageRail, UnitStageMatrix, DetailPanel |
| M-2 詳細パネル（解説/ビューア） | US-03/02/13/14 | StageCard, NextStepCallout, ArtifactViewer(Milkdown), AnswerEditor |
| M-3 参加者ビュー | US-10/11 | 上記の read-only ミラー + ReadOnlyBadge + LiveStatus |
| M-4 空/解析不可 | US-15 | EmptyState, UnparseableBadge, IntentPicker |

requirements.md の FR-4.x（Dashboard）・FR-6.x（ビューア）・FR-7.x（Mob）と、stories.md の受入基準に1:1で対応する。

---

## M-1: Dashboard（refined）

rough S-1 を踏襲。プロミネンス階層 NowStrip → StageRail → Matrix（FR-4.1/Q2-A）。トークンは design-system-mapping.md 参照。

```
┌───────────────────────────────────────────────────────────────── banner ─┐
│ AIDLC Guide      [IntentPicker: 260719-tb-lxp-mvp ▾]   [◐ ThemeToggle] [?] │
├──────────────────────────────────────────────────── region "現在地" ──────┤
│ ● CONSTRUCTION  ▸ code-generation (3.5)  ▸ unit: reader-core                │  NowStrip
│   Depth: Standard   Gate: ◔ awaiting approval(黄)   Done 15 / 22            │  (h2, gate はStatusChip)
├──────────── nav "ステージ一覧" ───┬───────────── section "成果物マトリクス"─┤
│ IDEATION                          │        3.1  3.2  3.3  3.5  3.6           │
│  ✔ intent-capture      (StatusChip)│ reader-core ✔2  ✔1  ✔1  ◐3   ·         │
│  ⊘ market-research (SKIP ▸理由)    │ mcp-server  ✔2  ✔1  ·   ○    ·         │
│  ✔ feasibility                    │ ...                                     │
│  ● code-generation ◀ (現在)       │ 凡例(StatusLegend): ✔完了 ◐進行 ◔ゲート │
│  ○ build-and-test                 │   待ち ○未 ⊘SKIP ·空 —対象外           │
│  ▸ SKIP (11) 折りたたみ           │ (セル= MatrixCell: 件数 + verdictBadge)│
└───────────────────────────────────┴─────────────────────────────────────┘
```

### M-1 の5状態（Q2-A）

| 状態 | 表示 |
|------|------|
| loading | NowStrip/rail/matrix をスケルトン（`aria-busy=true`）。初回描画目標 3秒（NFR-2/US-20）|
| empty | アクティブインテント無 → M-4 の EmptyState に遷移 |
| error | state パース不能 → NowStrip に UnparseableBadge、他は可能な範囲で表示（NFR-6/US-15）|
| partial | 一部ユニットの成果物欠落 → 該当 MatrixCell のみ「解析不可」、他セルは通常（US-15 partial）|
| success | 全要素が読める通常表示 |

---

## M-2: 詳細パネル（右・Q3-A のトークンで着彩）

StageRail/Matrix クリックで開く complementary パネル（FR-4.2）。2モード：

### M-2a StageCard（解説・US-03）
4フィールド必須（US-03 AC）: ①目的 ②入力→出力 ③担当エージェント ④ゲート要求 + docs deep-link（US-23）。用語は用語カード（US-04）へリンク。

#### NextStepCallout（US-02 / FR-4.6）— **現在ステージカード限定**
StageCard が **現在ステージ**（`aria-current=step`）を表示している場合のみ、カード末尾に独立した `NextStepCallout` 区画を出す。これは US-03 の「そのステージ自身の解説」とは別の要素で、**次の in-scope ステージ**の情報を示す：

```
┌─ StageCard: code-generation (現在) ──────────────┐
│ 目的 / 入出力 / 担当 / ゲート要求  … (US-03 の4項)│
│ ─────────────────────────────────────────────── │
│ ▸ 次に進むと（NextStepCallout / US-02）          │  ← 別区画
│   次のステージ: build-and-test (3.6)              │  ← 次ステージ「名」
│   そこで求められること: コード+テストの承認ゲート │  ← next steps
│   [その解説を見る →]                              │
└──────────────────────────────────────────────────┘
```

- **表示条件**: `stage === currentStage`。過去/未来ステージのカードには出さない（そこは US-03 の自ステージ解説のみ）。
- **内容**: 次の in-scope ステージの **名前** + **そこで人間に求められること**（ゲート種別/質問の有無）。データは reader-core の next-stage 解決（FR-2.3/US-09b `aidlc_next_steps` と同じロジック）。
- **1クリック到達**: Now strip の現在ステージから当該カードを開く操作（1クリック）で本区画が見える。カードを開く＝ US-02 の「1クリックで次ステップ」を満たす。
- **AC 対応**: US-02 / FR-4.6（S-1 到達性の第二要素）。US-03（自ステージ解説）とは区画・データ源ともに別。

### M-2b ArtifactViewer（US-13/14）
Milkdown で WYSIWYG（FR-6.1）。Mermaid レンダリング（FR-6.3）。既定 read-only。`*-questions.md` の `[Answer]:` 行のみ AnswerEditor が編集可（FR-6.2/US-14、行外はバイト不変）。

**5状態**: loading=スケルトン / empty=「成果物なし」/ error=Milkdown 崩れ検知時は plain preview にフォールバック（feasibility R-2/US-13）/ partial=部分レンダリング / success=完全表示。

---

## M-3: 参加者ビュー（US-10/11）

M-1 と同一レイアウト。差分: ReadOnlyBadge（`role=status`）、編集 UI は DOM 不在（US-11、project.md 由来の設計）、LiveStatus（WebSocket 接続状態 + 最終更新、`aria-live=polite`）。反映は変更→2秒（NFR-3/US-20）。サーバ側で書込拒否（US-11 AC）。

### M-3 の5状態（Q2-A、M-1 を継承 + 接続状態）

| 状態 | 表示 |
|------|------|
| loading | 初回接続待ち。スケルトン + LiveStatus「接続中」（`aria-busy`）|
| empty | ドライバー側にアクティブインテント無 → EmptyState をミラー表示 |
| error | WebSocket 切断 → LiveStatus「切断・再接続中」（`aria-live=polite`）、最後に受信した状態を保持表示（全画面エラーにしない）|
| partial | ドライバー側の部分欠落をそのままミラー（該当セルのみ解析不可）|
| success | ライブ同期中。push で差分反映（NFR-3）|

---

## M-4: 空 / 解析不可（US-15）

- **EmptyState**（インテント未生成）: h2「インテントがありません」+ IntentPicker（最初のフォーカス可能要素）+ 説明。`role=alert` で初回読み上げ。
- **UnparseableBadge**（局所）: 該当セル/カードに `role=status` + テキスト「解析不可（理由）」。色のみ非依存（US-18）。全画面エラーにしない（NFR-6）。

---

## レスポンシブ / フォームファクタ

デスクトップ単一（rough Q1）。最小幅 1280px。3ペイン（rail 固定幅 / matrix 可変 / detail パネルはオーバーレイ的に右から）。1280px 未満は matrix を横スクロール（`overflow-x:auto`）にして body の横スクロールを防ぐ。モバイルは非対象。

## トレーサビリティ

各画面は stories.md（US-01〜US-23）と requirements.md（FR-4/6/7、NFR-2/3/6/7）に対応。team-practices.md の「色+記号+ラベル三重表現」「reader-core 一方向依存（UI は reader を消費するのみ）」を UI 層で遵守。

## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-07-23

- **Finding 1 (US-02/FR-4.6 UI representation) — RESOLVED.** mockups.md §M-2a now defines `NextStepCallout` (lines 60-77) as a distinct region inside the current-stage StageCard only (`表示条件: stage === currentStage`), separate from US-03's own-stage explanation, carrying the next stage's name + what's required of the human. interaction-spec.md C-4 (lines 41-47) mirrors this with explicit props (`nextStage`, `nextRequirement`) and the same current-stage-only gating. Matches FR-4.6's wording in requirements.md ("次のステージ名" + "そこで人間に求められること").
- **Finding 2 (upstream coverage in design-system-mapping.md / accessibility-checklist.md) — RESOLVED.** Both files' input lines now list `wireframes.md / user-flow.md（rough-mockups）+ stories.md` alongside mockups/interaction-spec/requirements/team-practices, and each adds a dedicated "上流根拠" paragraph citing specific upstream content (design-system-mapping.md line 6: wireframes' state-color table + rough Q6 + US-18 + user-flow's 3-persona flows; accessibility-checklist.md line 6: wireframes' per-screen a11y notes + US-18/US-11/US-15/US-02 + user-flow's flow-1 keyboard walkthrough).
- **Finding 3 (NFR-4 misattribution) — RESOLVED.** design-system-mapping.md line 55 now states the `--font-sans` choice is an "アンカー無しの設計判断" (unanchored design decision, no corresponding NFR) and explicitly clarifies NFR-4 is cross-platform path/watch/spawn behavior, not a font requirement. Cross-checked against requirements.md line 126 ("NFR-4 クロスプラットフォーム: Windows...と macOS で動作する") — the correction is accurate.
- **Finding 4 (M-3 5-state coverage) — RESOLVED.** mockups.md lines 90-98 add a "M-3 の5状態" table (loading/empty/error/partial/success) specific to the participant view, including connection-state handling (LiveStatus 切断・再接続中 on error, mirrored partial degradation).
- **Finding 5 (DetailPanel modal contradiction) — NOT RESOLVED.** mockups.md and interaction-spec.md were fixed (interaction-spec.md line 14 and line 37 now correctly specify Radix `FocusScope(trapped=false)` + `DismissableLayer`, no `aria-modal`, no focus trap), but **accessibility-checklist.md still contains the old contradictory language and was not updated**:
  - Line 18: "**キーボードトラップ回避（2.1.2）**: DetailPanel（**Radix Dialog**）は Esc で抜け、フォーカスはトリガへ復帰。"
  - Line 40 (surface table): "DetailPanel(M-2) | **Dialog フォーカストラップ** + Esc 復帰、read-only 領域 `aria-readonly`..."

  Both lines describe DetailPanel as a modal `Dialog` with a focus trap you "escape" from via Esc — directly contradicting the now-settled non-modal design (no trap, `FocusScope trapped=false`, `DismissableLayer`, no `aria-modal`) established in mockups.md/interaction-spec.md. A developer or QA engineer reading only accessibility-checklist.md would implement/test the wrong primitive (modal Dialog with trap) against the wrong behavior (backdrop, `aria-modal`, focus imprisonment) — exactly the contradiction flagged in iteration 1, just relocated to a file the previous fix pass didn't touch.

**Regression pass:** No new contradictions introduced; all required sections (画面インベントリ, M-1〜M-4, レスポンシブ, トレーサビリティ) intact across the four files; no malformed tokens found in design-system-mapping.md's token table.

**Required to reach READY:** Update accessibility-checklist.md lines 18 and 40 to describe DetailPanel per the settled non-modal primitive (FocusScope trapped=false + DismissableLayer; Esc closes via DismissableLayer, not "escapes a trap"; no `aria-modal`), consistent with interaction-spec.md line 37.


### Post-review resolution (lead, 2026-07-23)
レビューのイテレーション上限（2/2）到達後、Finding 5（accessibility-checklist.md の DetailPanel 記述が旧「Radix Dialog + フォーカストラップ」のままで非モーダル設計と矛盾）を、レビュアー指定どおり修正: accessibility-checklist.md の該当2箇所を FocusScope(trapped=false) + DismissableLayer / トラップ無し・`aria-modal` 無し に統一。これで4成果物すべてが非モーダル設計で整合。Findings 1〜4 はイテレーション2で解決済み。→ 全5件解決。
