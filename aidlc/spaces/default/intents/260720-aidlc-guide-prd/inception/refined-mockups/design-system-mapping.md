# Design System Mapping — AIDLC Guide

> ステージ: refined-mockups (Inception 2.5) / 作成日: 2026-07-23
> 入力: mockups.md + interaction-spec.md + wireframes.md / user-flow.md（rough-mockups）+ stories.md + requirements.md + team-practices.md
> 方式（Q3-A）: CSS カスタムプロパティで意味的トークンを定義し、`prefers-color-scheme` + `[data-theme]` でライト/ダーク切替。既存デザインシステムは無い（新規ツール）ため、最小の意味的トークンセットを新設する。
> 上流根拠: wireframes.md の状態色表（緑/青/黄/灰）と rough Q6「ライト/ダーク両対応」を意味的トークンに昇格。stories.md の US-18（色覚非依存）が三重表現マップの直接の根拠。user-flow.md の3ペルソナ全フローが同一トークン下で読めることを前提とする。

## トークン方針

- **意味的（semantic）トークン**を UI が参照し、原始値（primitive）はテーマ層で解決。コンポーネントは `--color-status-done` のような意味名のみ使い、生の hex を書かない。
- ライト/ダーク両対応（rough Q6）: `:root` にライト、`@media (prefers-color-scheme: dark)` と `:root[data-theme=dark]` にダーク（ThemeToggle が `data-theme` を上書き、両方向で勝つ）。
- 状態色は **両テーマで WCAG 2.1 AA** を満たす値に固定（テキスト 4.5:1 / 非テキスト 3:1）。色は常に記号+ラベルと併用（team.md 規約）ため、色は補助であり単独の情報担体ではない。

## トークン表（意味的）

| トークン | 用途 | ライト（目安） | ダーク（目安） | コントラスト要件 |
|----------|------|--------------|--------------|----------------|
| `--color-bg` | 背景 | #ffffff | #0f1116 | — |
| `--color-fg` | 本文 | #1a1d23 | #e6e8ec | 対 bg 4.5:1 |
| `--color-muted` | 補助文字 | #5b6270 | #9aa2b1 | 対 bg 4.5:1 |
| `--color-border` | 罫線 | #d8dce3 | #2a2f3a | 対 bg 3:1 |
| `--color-status-done` | 完了(緑) | #1e7d34 | #4caf6a | 対 bg 3:1（非テキスト）|
| `--color-status-progress` | 進行中(青) | #1966c2 | #5b9bf0 | 3:1 |
| `--color-status-gate` | ゲート待ち(琥珀) | #9a6700 | #e0b341 | 3:1 |
| `--color-status-revising` | 修正中(紫) | #7b3fb5 | #b98ae8 | 3:1 |
| `--color-status-idle` | 未着手(灰) | #6b7280 | #8b93a1 | 3:1 |
| `--color-status-skip` | SKIP(薄灰破線) | #9aa0aa | #6a7280 | 3:1 |
| `--color-danger` | 解析不可 | #b3261e | #f2726a | 対 bg 4.5:1 |

> 具体 hex は実装で最終調整。要件は「AA を満たす」こと（実装時にコントラスト自動チェックを CI/ローカルゲートで検証可能）。

## 状態の三重表現マップ（team.md / US-18）

| 状態 | 色トークン | 記号 | テキストラベル |
|------|-----------|------|--------------|
| 完了 | `--color-status-done` | ✔ | completed |
| 進行中 | `--color-status-progress` | ◐ | in progress |
| ゲート待ち | `--color-status-gate` | ◔ | awaiting approval |
| 修正中 | `--color-status-revising` | ◑ | revising |
| 未着手 | `--color-status-idle` | ○ | not started |
| SKIP | `--color-status-skip` | ⊘ | skipped |
| 解析不可 | `--color-danger` | ⚠ | unparseable |

## タイポグラフィ / スペーシング（最小トークン）

- タイポ: `--font-sans`（システムフォントスタック）, `--font-mono`（コード/state 断片）。サイズは `--text-sm/base/lg/xl` の4段。
- スペーシング: 4px グリッド（`--space-1=4px` … `--space-6=24px`）。
- 角丸/影: `--radius`, `--shadow-panel`（DetailPanel の浮き）。

## コンポーネント → トークン適用

- StatusChip: `background`/`border` に状態色トークン、記号 + ラベルは常時。
- NowStrip/StageRail/Matrix: `--color-bg/fg/border` + 状態色。
- DetailPanel: `--shadow-panel` + `--color-bg`。

## トレーサビリティ
本マッピングは stories.md の US-18（色覚非依存の三重表現）と wireframes.md の状態色表を直接の根拠とし、team-practices.md の「色+記号+ラベル三重表現」「Biome 単一フォーマッタ（CSS もフォーマット対象）」に整合する。`--font-sans`（システムフォントスタック）の採用は requirements.md に対応する NFR が無い **アンカー無しの設計判断**（依存最小・両OSで追加フォント不要という実務判断）であり、NFR-4 とは無関係（NFR-4 はパス処理・ファイル監視・プロセス起動の両OS動作であってフォントの要件ではない）。特定 UI フレームワークのデザインシステムには依存しない（自作トークン、Q1/Q3）。
