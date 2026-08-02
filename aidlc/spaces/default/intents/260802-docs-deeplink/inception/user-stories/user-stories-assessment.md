# User Stories Assessment — Docs i18n Bolt 3

> ステージ: user-stories (Inception 2.4) / 2026-08-02  
> Intent: `260802-docs-deeplink`（Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29)）

## Decision

**Execute**

## Rationale

Bolt 3 は **user-facing** な導線変更である。ドライバーが StageCard から拡張内 Docs Shell へ着地する（親 US-05 / FR-U3 / FR-B3）。ペルソナ（P2 ドライバー中心、P1 受益）と受入可能なストーリー単位が、Construction の unit 分割とデモ（intent-capture StageCard → Shell）を支える。

## Factors considered

| Factor | Signal |
|--------|--------|
| Project type | Brownfield feature（Bolt 2 完了後の差分） |
| User-facing | StageCard リンク文言・活性化・Shell 着地 |
| Personas | 親 P1/P2/P3 継承。Bolt 3 主利用者は P2 |
| Complexity | openOfficialDoc 契約・mapped/unmapped・locale/anchor・レガシー置換 |
| Alternatives | requirements のみ → デモ／GWT 受入が薄い |

## Where stories add most value

1. Mapped StageCard → openOfficialDoc → Shell path/anchor/locale  
2. Unmapped slug → Shell top  
3. Label ≠ bare `Docs`  
4. レガシー `docsOpenHref` / IDE open-doc 非使用  
5. Demo / check 対象の検証ストーリー

## Out of scope for this stage's stories

- B4 Bridge（#30）、B5 Diff report（#31）  
- locale keep-path / missing_ja（Bolt 2 完了）  
- 7 slug 集合の拡張  
