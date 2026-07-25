# Scalability Design — Unit: btw

> nfr-design (3.3) / Unit: btw / 2026-07-23
> 入力: nfr-requirements/scalability-requirements.md（適用なし宣言）

## 設計なし（要件側で N/A 確定）

scalability-requirements.md のとおり構造的に非該当（ワンショット・状態なし・listen なし）。唯一のデータ量軸（セッション件数）は performance-design.md の O(n) 単走査で吸収済み。本書は空欄でなく「設計しないという設計判断」の記録として置く。

## 将来トリガー

もし btw が常駐化（ウォッチャー等）する要求が出たら、その時点で本書を実設計に差し替える（現時点の要求には存在しない — YAGNI）。
