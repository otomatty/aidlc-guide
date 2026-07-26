# Tech Stack Decisions — Unit: dashboard-ui

> nfr-requirements (3.2) / Unit: dashboard-ui / 2026-07-24 (updated 2026-07-26)
> 入力: functional-design 4文書 + refined-mockups + requirements.md（PRD §7）+ team-practices.md

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| フレームワーク | **Vite + React**（TypeScript） | PRD §7 / チーム既存スタック |
| 状態管理 | React context + useReducer（外部ライブラリなし） | 単一ストア・領域 slice で十分（domain-entities） |
| UI キット | **shadcn/ui（Base UI + nova preset）** | 2026-07-26 方針変更: ボタン・ダイアログ・バッジ等の共通 UI を shadcn コンポーネント（ソース同梱）に統一。DetailPanel / GuidesPanel の非モーダルシェルは Radix FocusScope + DismissableLayer を維持 |
| a11y プリミティブ | **Base UI（shadcn Dialog 等）+ Radix FocusScope / DismissableLayer** | モーダルは shadcn Dialog。非モーダル右パネルは従来どおり untrapped FocusScope |
| スタイル | **Tailwind CSS v4 + shadcn セマンティックトークン** | 2026-07-26 方針変更: 旧「プレーン CSS + Tailwind 不採用」を撤回。ドメイン固有（マトリクスセル・StatusChip・viewer/hljs）のみ `app.css` に残す |
| アイコン | **lucide-react**（shadcn 既定） | ThemeToggle・パネルナビ・Dialog close 等 |
| Markdown 表示 | **本 Unit では使わない**（artifact-viewer Unit の責務 — S-UI-3） | Unit 境界 |
| dev-time | Vitest + @testing-library/react + Biome | team.md |

## 決定メモ

- **2026-07-26 撤回**: 初期 construction では「Tailwind 不採用・フル UI キット不採用」を選定したが、運用上 shadcn/ui への統一を優先。`dependency-direction.test.ts` は完全一致 allowlist から必須/禁止方式へ緩和。
- code-split: matrix と viewer を動的 import にして初期バンドルを小さく保つ（P-UI-1）。
- テーマ: `ThemeToggle` が `document.documentElement` に `class="dark"` と `data-theme` を書く（shadcn dark variant + hljs 互換）。
- 日付整形は `Intl.RelativeTimeFormat`（ビルトイン — date ライブラリ不要）。
