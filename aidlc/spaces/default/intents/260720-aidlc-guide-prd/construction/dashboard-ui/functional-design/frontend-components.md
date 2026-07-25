# Frontend Components — Unit: dashboard-ui

> functional-design (3.1) / Unit: dashboard-ui (kind: ui — 本成果物は kind:ui のみに適用) / 2026-07-24
> 入力: refined-mockups（mockups.md M-1/M-2a/M-4・interaction-spec.md C-1〜C-4・design-system-mapping.md・accessibility-checklist.md）+ domain-entities.md

## コンポーネント階層

```
App                                    ErrorBoundary（全体）+ ThemeProvider
 ├ Header                              banner: タイトル / IntentPicker / ThemeToggle / help
 ├ NowStrip                            region「現在地」h2（US-01）
 ├ main
 │   ├ StageRail                       nav「ステージ一覧」（US-16）
 │   │   ├ PhaseGroup ×5               フェーズ見出し
 │   │   │   └ StageRailItem           StatusChip + aria-current=step
 │   │   └ SkipGroup                   details 折りたたみ + 理由（FR-4.5）
 │   └ UnitStageMatrix                 section「成果物マトリクス」（US-05）
 │       └ MatrixCell                  件数 + verdict バッジ + cell.error 縮退
 └ DetailPanel                         complementary・非モーダル（selected≠null で開）
     └ StageCard                       4フィールド + docs deep-link（US-03）
         └ NextStepCallout             現在ステージのみ（US-02）

横断: StatusChip / StatusLegend / EmptyState / UnparseableBadge / LiveStatus / Skeleton /
      AreaBoundary（領域単位 ErrorBoundary — NowStrip/StageRail/Matrix/DetailPanel を個別に包む。
      App 直下の全体 ErrorBoundary との二段構え — R-UI-1）
```

## 主要コンポーネント仕様

### NowStrip（US-01 / FR-4.1）
- **Props**: `{ state: ViewState<WorkflowModel> }`
- **表示**: phase / currentStage / unit（あれば）/ depth / gate（StatusChip）/ done・total
- **状態**: loading→Skeleton、empty→EmptyState へ委譲、error→UnparseableBadge、success→通常
- **a11y**: h2 + region ラベル。起動時のフォーカス位置

### StageRail（US-16/18 / FR-4.2, FR-4.5）
- **Props**: `{ stages: StageInfo[], current: string|null, onSelect(slug) }`
- **操作**: 上下キーで移動（roving tabindex: tabIndex=0 は常に1つ）、Enter で onSelect
- **SKIP**: 連続 SKIP を details に集約、summary に件数、展開で「スコープ由来のSKIP」

### UnitStageMatrix（US-05 / FR-4.3）
- **Props**: `{ state: ViewState<Matrix>, onSelectCell(unit, stage) }`
- **構造**: table + 行/列ヘッダ th（scope 属性）。セルは件数 + verdict + error 縮退
- **空 vs 対象外**: units × stages の直積を描画し、`Matrix.cells` に該当交点が**無ければ「対象外」（—）**、あって `count===0` なら「空」（·）（FR-4.3 AC / BLM 導出ロジック）
- **横スクロール**: 自身の overflow-x:auto（body を横スクロールさせない — refined-mockups）

### StageCard + NextStepCallout（US-03/02 / FR-4.4, FR-4.6）
- **StageCard Props**: `{ doc: StageDoc, isCurrent: boolean, nextStep?: NextStep }`（`doc` は選択時に `GET /api/stage/:slug` で取得し `stageDoc` slice に格納されたもの — BLM 手順6。`StageDoc` の定義は docs-bridge、shared-types 経由で参照）
- **StageCard**: 目的 / 入出力 / 担当エージェント / ゲート要求 + docs リンク（4フィールド必須）
- **NextStepCallout**: `isCurrent === true` のときのみレンダリング。次ステージ名 + そこで求められること + 「その解説を見る →」

### StatusChip（US-18 / BR-UI-2）
- **Props**: `{ status: StageStatus | "unparseable" }`（7値 — `revising` を含む）
- **描画**: span に 色トークン + 記号 + テキストラベル（3要素すべて DOM に存在）。マップは design-system-mapping の三重表現表7行と1:1（`revising` = `--color-status-revising` / ◑ / revising）
- **検証**: グレースケールでも判別可能（記号 + ラベル）

### DetailPanel（非モーダル）
- **Props**: `{ selected, onClose }`
- **挙動**: 右からスライドイン（prefers-reduced-motion で無効）。開時に見出しへフォーカス移動、Esc/外側クリックで閉じてトリガへ復帰。フォーカストラップなし・aria-modal なし（FocusScope trapped=false + DismissableLayer）

## レスポンシブ / テーマ

デスクトップ単一（最小 1280px）。テーマは CSS カスタムプロパティ + prefers-color-scheme + data-theme 属性（design-system-mapping）。
