# Scalability Requirements — Unit: dashboard-ui

> nfr-requirements (3.2) / Unit: dashboard-ui / 2026-07-24
> 入力: performance-requirements.md（P-UI-4）+ requirements.md

## データ量軸（UI が扱う要素数）

| ID | 要件 |
|----|------|
| SC-UI-1 | Stage rail: 32 ステージ規模で仮想化不要（DOM 要素数が小さい） |
| SC-UI-2 | Matrix: ユニット数 × Construction ステージ数（現実的に 数十×5 = **500セル以下**）で仮想化不要（P-UI-4 が同じ 500 セル上限をベンチ対象とする — 見積りレンジ一致）。**ユニット数が 50（=250セル）を超えたら**行仮想化を検討（再訪トリガー） |
| SC-UI-3 | 監査イベント表示は本 Unit の範囲外（BLM: audit scope 非消費） |

## 非該当

同時ユーザーはブラウザ単位で独立（サーバが broadcast するだけ — UI 側にスケール概念なし）。
