# Performance Design — Unit: dashboard-ui

> nfr-design (3.3) / Unit: dashboard-ui / 2026-07-24
> 入力: nfr-requirements/performance-requirements.md（P-UI-1〜5）+ functional-design/business-logic-model.md

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-UI-1（SPA ロード ≤1.0s） | Vite の code-split: matrix と（後続の）viewer を `React.lazy` + dynamic import。初期チャンクは Header/NowStrip/StageRail + トークン CSS のみ |
| P-UI-2（初回描画 ≤0.7s） | `/api/workflow` を index.html 読込直後（Reactマウント前）に fetch 開始（bootstrap で promise を先行発火し、マウント時には解決済みを使う） |
| P-UI-3（変更反映 ≤0.5s） | reducer が scope 別 slice のみ差し替え → React の参照等価性で該当サブツリーのみ再描画（memo 境界を NowStrip / StageRail / Matrix / DetailPanel に置く） |
| P-UI-4（500セル ≤300ms） | セルは軽量（span 3要素）。行単位 memo で unit 差分更新時に他行を再描画しない。仮想化なし（500 まで） |
| P-UI-5（スケルトン 200ms） | `useDelayedLoading(200)` フックで一元化（各領域が同じ閾値を使う） |

## 非採用

SSR/プリレンダ（ローカル配信で不要）、状態の永続化（起動毎に取り直すのが正）。
