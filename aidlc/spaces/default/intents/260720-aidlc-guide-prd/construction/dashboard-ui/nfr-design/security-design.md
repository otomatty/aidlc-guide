# Security Design — Unit: dashboard-ui

> nfr-design (3.3) / Unit: dashboard-ui / 2026-07-24
> 入力: nfr-requirements/security-requirements.md（S-UI-1〜5）+ functional-design/business-rules.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| S-UI-1（書込 UI なし） | API クライアント（`services/api.ts`）に GET/WS 購読のみを実装し、POST 関数を持たない（型レベルで書込不能） |
| S-UI-2（FS アクセスなし） | reader-core を package.json の依存に入れない（ビルドで解決不能 = 構造的禁止）。型は shared-types のみ |
| S-UI-3（生 HTML 挿入禁止） | Biome ルールで `dangerouslySetInnerHTML` を本パッケージ禁止。解説カードは構造化フィールドを JSX で組む（Markdown を扱わない） |
| S-UI-4（リンク先の限定） | deep-link は docs-bridge 由来の `{docPath, docAnchor}` から生成。外部 URL は `projectLinks` の設定値のみ（`rel="noopener noreferrer"` 付与） |
| S-UI-5（Mob 時の追加露出なし） | UI はサーバ応答の範囲しか描画しない（クライアント側で追加のデータ取得経路を持たない） |

## 信頼境界

ブラウザ内で完結。境界はサーバ API（同一オリジン）1点。ユーザー入力は IntentPicker の選択（列挙値）とテーマ切替のみ — 自由入力なし。
