# Performance Design — Unit: artifact-viewer

> nfr-design (3.3) / Unit: artifact-viewer / 2026-07-25
> 入力: nfr-requirements/performance-requirements.md（P-AV-1〜5）+ functional-design（D1〜D3・データ契約）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| P-AV-1（初期バンドル非混入） | dashboard-ui の DetailPanel が `React.lazy(() => import("artifact-viewer"))`。本 Unit の package は dashboard の依存に入るが**動的 import 経由のみ**参照（静的 import を Biome ルールで禁止） |
| P-AV-2（初回 ≤1.5s / 2回目 ≤0.8s） | チャンク取得と `GET /api/artifact` を**並行**発火（開く操作の時点で両方開始し、Promise.all で待つ） |
| P-AV-3（Mermaid ≤500ms/図） | `mermaid` は MermaidBlock 内で初回出現時に動的 import し、モジュールスコープでメモ化（2図目以降は再ロードしない）。図は逐次描画（1図の失敗が他を止めない） |
| P-AV-4（保存 ≤1.5s） | POST → 200 → `GET /api/artifact` 再取得 → 文字列比較1回（対象行を除いた前後スライスの `===` 比較。差分アルゴリズムを使わない） |
| P-AV-5（大サイズ） | 取得したバイト長が **1MB 超なら MarkdownSurface をリッチ描画せず plain preview 経路**に固定（描画前に判定 — 重い描画に入らない） |

## 非採用

仮想スクロール（成果物1枚は数十KB規模が主）、描画結果のキャッシュ（開き直しは稀 + 最新性優先）。
