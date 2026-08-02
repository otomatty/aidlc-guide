# User Stories Assessment — Docs i18n Bolt 2

> ステージ: user-stories (Inception 2.4) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`  
> 改訂: requirements READY 改訂版（FR-B2 / NFR-B2 / OfficialDocsPage）に整合

## Decision

**Execute** — user stories add value for this Bolt.

## Rationale

Bolt 2 はユーザー向け UI（Docs Shell の locale 切替・未訳 notice）を含むため、user stories が有効。親 intent `260730-docs-i18n` で US-03 / US-04 の契約は定義済みであり、本 intent は **実装レベルの詳細化** に留める。改訂 requirements の wire 契約（`notice: "missing_ja"`）と coverage ファイル境界（NFR-B2-1）をストーリー受入に反映する。

## Factors Considered

| 要因 | 評価 |
|------|------|
| プロジェクトタイプ | Brownfield 延長（親 intent で基盤確立済み） |
| ユーザー向けスコープ | あり（Docs Shell の locale/untranslated UI） |
| 複雑性 | 中（状態管理・a11y・フォールバック・既存 wire） |
| ペルソナ | 親 intent の P1/P2/P3 を継承、P1 に集中 |

## Key Areas Where Stories Add Value

- US-B2-01: keep-path（未訳時も path 維持）・TOC 非対称・anchor フォールバック
- US-B2-02: 未訳 notice（`role=status`）・locale 維持・`OfficialDocsPage.notice`
- US-B2-03: coverage 床（named files）の CI ゲート化
- US-B2-S1: h1（Should）

## Alternative Coverage

親 intent の US-03 / US-04 が契約レベルで存在するため、本 intent のストーリーは実装詳細に特化。mob（design / developer / quality の並列レビュー）は親 intent で実施済みのため省略し、成果物を継承する。

## Mob Status

**Skipped** — 親 intent で mob 実施済み。本 intent は実装 polish のため、親 intent の mob 結果を継承。
