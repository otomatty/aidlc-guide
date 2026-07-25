# Business Rules — Unit: dashboard-ui

> functional-design (3.1) / Unit: dashboard-ui / 2026-07-24
> 入力: requirements.md（FR-4, NFR-1/6）+ refined-mockups（a11y checklist / design-system-mapping）+ project.md Code Style + team.md 構造規約

## ルール

| ID | ルール | 出所 |
|----|--------|------|
| BR-UI-1 | **reader-core を import しない**（データは HTTP/WS のみ、型は shared-types のみ）。FS アクセスをブラウザに持ち込まない | team.md 規約1 / DAG |
| BR-UI-2 | **状態表示は色 + 記号 + テキストラベルの三重**（StatusChip 単一コンポーネントに集約 — 例外を作らない） | project.md Code Style / US-18 |
| BR-UI-3 | **数え直さない**: done/total/verdict 等はサーバ由来の値をそのまま表示（UI で再計算しない — 二重真実を作らない） | 設計整合 |
| BR-UI-4 | **縮退を握り潰さない**: unsupported/error/warnings/cell.error は必ず可視化（黙って空表示にしない） | NFR-6 |
| BR-UI-5 | 全画面クラッシュ禁止: 領域単位の ErrorBoundary + 未取得はスケルトン | NFR-6 |
| BR-UI-6 | **a11y**: WCAG 2.1 AA。landmark・aria-current=step・フォーカス管理（非モーダル DetailPanel は FocusScope trapped=false）・prefers-reduced-motion 尊重 | a11y checklist |
| BR-UI-7 | 書込 UI は本 Unit に持たない（AnswerEditor は artifact-viewer Unit。read-only の UI 層） | Unit 境界 |

## 表示規約

- 日本語 UI。ステージ slug は原文（英語）のまま表示し、解説文で日本語補足（slug は識別子であり翻訳しない）。
- 相対時刻（監査イベント）は「3分前」形式 + title 属性に絶対時刻。
