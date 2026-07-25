# Scalability Design — Unit: dashboard-server

> nfr-design (3.3) / Unit: dashboard-server / 2026-07-24
> 入力: nfr-requirements/scalability-requirements.md

## 設計なし（要件側で上限確定）

SC-DS-1 の 10 接続上限に対し追加機構なし（P-DS-4 の同期ファンアウトで充足）。接続数の上限強制もしない（社内モブで超えない — 超えたら遅くなるだけで壊れない）。SC-DS-2（データ量スケール）は reader-core への委譲であり本 Unit に設計なし — サーバは reader の返すモデルを透過するだけで自前のデータ構造を持たない（matrixCache は reader の Matrix をそのまま保持）。

## 再訪トリガー

モブ規模が数十接続級になり broadcast 遅延が NFR-3 を破ったら、per-client キュー/串刺し送信を検討。
