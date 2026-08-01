# User Stories Assessment — Docs i18n

> ステージ: user-stories (Inception 2.4) / 2026-07-31  
> Intent: `260730-docs-i18n`

## Decision

**Execute**

## Rationale

- User-facing: Docs Shell、言語切替、Dashboard 深リンク、Bridge 誘導はすべて人が触る UI
- Multiple personas: 初学者エンジニア（主）、ドライバー、ドキュメント整備担当（intent / stakeholder-map）
- Cross-cutting: 拡張 Webview + api-core + コンテンツ運用（翻訳 PR）

## Factors considered

| Factor | Signal |
|--------|--------|
| Project type | Brownfield feature |
| User-facing scope | High (S-docs-1) |
| Complexity | Standard — multi-surface, partial i18n, ops workflow |
| Alternative | requirements.md alone would underspecify persona journeys |

## Value of stories here

- FR-U2 / FR-U3 のハッピーパスを persona × 受入で固定
- FR-U5（翻訳 PR）を整備担当ストーリーとして分離
- Should（diff report / bridge-map）の切り下げ境界を物語で明示
