# Refined Mockups — 質問ファイル

> ステージ: refined-mockups (Inception 2.5) / 深度: Standard / lead: design + product support
> 入力: wireframes.md + user-flow.md（rough-mockups）+ stories.md（22US）+ requirements.md + team-practices.md
> rough-mockups で確定済み（デスクトップ単一 / Now strip→rail→matrix / 右サイドパネル / WCAG 2.1 AA / 参加者=同一+バッジ / ライト・ダーク / 色+記号+ラベル）。質問は「中〜高忠実度化に必要な3点（コンポーネント方針・状態網羅・トークン）」に絞ります。各質問 A-E + X。

---

## Q1. コンポーネント / デザインシステム方針

React + Biome の構成。UI コンポーネントの調達方針は？（アクセシビリティ FR-4.2/US-18・フォーカス管理が要る右パネル/モーダルに影響）

- A. 自作の軽量コンポーネント + アクセシビリティが要る部品（ダイアログ/パネルのフォーカストラップ・rail のroving tabindex）のみ Radix UI 等のヘッドレスプリミティブを使う — 推奨（依存最小 × a11y 担保）
- B. フル UI キット（MUI / Chakra 等）を採用（実装速いが依存重・ダーク対応や bundle が重い）
- C. プレーン HTML+CSS のみ（依存ゼロだがフォーカス管理・a11y を全自作）
- X. その他（記入）

[Answer]: A（自作軽量 + a11y必要部品のみRadix等ヘッドレスプリミティブ / Mode: batch-recommended）

## Q2. 画面が扱う状態の網羅範囲

各データ駆動画面（Dashboard/マトリクス/ビューア）がスペックすべき状態は？

- A. loading / empty(初回・データなし) / error(解析不可 NFR-6) / partial(部分欠落) / success の5状態を各画面で明示 — 推奨（US-15 fail-soft と整合）
- B. success / error の2状態のみ（loading/empty は簡略）
- C. success のみ（状態は実装時に判断）
- X. その他（記入）

[Answer]: A（loading/empty/error/partial/success の5状態を各データ駆動画面で明示 / Mode: batch-recommended）

## Q3. デザイントークン（テーマ/配色の具体化）

ライト/ダーク両対応（rough Q6）を高忠実度で具体化する方式は？

- A. CSS カスタムプロパティで意味的トークン（--color-bg/--color-status-done 等）を定義し、`prefers-color-scheme` + `[data-theme]` でライト/ダーク切替。状態色は両テーマで WCAG AA コントラスト（テキスト4.5:1/非テキスト3:1）を満たす値をトークン表に固定 — 推奨
- B. Tailwind のテーマ設定に寄せる（ユーティリティ中心）
- C. 具体トークンは実装時に決める（本ステージは配色原則のみ）
- X. その他（記入）

[Answer]: A（CSSカスタムプロパティで意味的トークン + prefers-color-scheme/[data-theme]切替、状態色は両テーマWCAG AA / Mode: batch-recommended）

---

## Consolidated Summary Confirmation

- Q1: A — 自作軽量 + a11y部品のみRadix
- Q2: A — 5状態(loading/empty/error/partial/success)明示
- Q3: A — CSSカスタムプロパティ意味的トークン + テーマ切替

Does this look correct before I generate the refined mockups + interaction spec + design-system mapping + a11y checklist?

- Looks correct: この方針で成果物を生成する
- Request changes: 方針を修正する

[Answer]: Looks correct（2026-07-23 / Mode: batch-recommended）

---

## §13 Learnings（回答済み — 2026-07-23）

- A. c1: 次ステップは独立コンポーネント（project.md/Code Style へ）
- B. c2: 非モーダルpanelのprimitive選択
- D. 残さない

[Answer]: A（c1のみ — project.md ## Code Style へ永続化。c2/c3 は memory.md 保持）

追加メモ（Anything to add for next time?）: Nothing to add

[Answer]: Nothing to add
