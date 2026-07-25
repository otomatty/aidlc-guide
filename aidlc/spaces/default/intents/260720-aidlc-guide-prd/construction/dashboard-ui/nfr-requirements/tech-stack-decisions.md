# Tech Stack Decisions — Unit: dashboard-ui

> nfr-requirements (3.2) / Unit: dashboard-ui / 2026-07-24
> 入力: functional-design 4文書 + refined-mockups（Q1 コンポーネント方針 / Q3 トークン）+ requirements.md（PRD §7）+ team-practices.md

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| フレームワーク | **Vite + React**（TypeScript） | PRD §7 / チーム既存スタック |
| 状態管理 | React context + useReducer（外部ライブラリなし） | 単一ストア・領域 slice で十分（domain-entities）。Redux/Zustand は過剰 |
| a11y プリミティブ | **Radix の FocusScope / DismissableLayer / Select のみ**（フル UI キット不採用 — refined-mockups Q1-A） | 依存最小 × フォーカス管理の正しさ |
| スタイル | CSS カスタムプロパティ（意味的トークン）+ プレーン CSS Modules | design-system-mapping Q3-A。Tailwind 不採用（トークン方式と二重管理になる） |
| Markdown 表示 | **本 Unit では使わない**（artifact-viewer Unit の責務 — S-UI-3） | Unit 境界 |
| dev-time | Vitest + @testing-library/react（team.md の UI テスト方針）+ Biome | team.md |

## 決定メモ

- code-split: matrix と（後続 Unit の）viewer を動的 import にして初期バンドルを小さく保つ（P-UI-1）。
- 日付整形は `Intl.RelativeTimeFormat`（ビルトイン — date ライブラリ不要）。
