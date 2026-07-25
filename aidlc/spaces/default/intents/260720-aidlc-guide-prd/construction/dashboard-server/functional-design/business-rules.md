# Business Rules — Unit: dashboard-server

> functional-design (3.1) / Unit: dashboard-server / 2026-07-24
> 入力: requirements.md（NFR-1/7）+ components.md C5 + services.md + project.md Mandated + ADR-03/04

## ルール

| ID | ルール | 出所 |
|----|--------|------|
| BR-DS-1 | 書込は AnswerWriter の 7 ステップゲートのみ。他の全ハンドラは読取専用（write API を持つモジュールは answer-writer.ts 1つ — 構造的隔離） | NFR-1 / Mandated |
| BR-DS-2 | 既定 bind は 127.0.0.1。0.0.0.0 は --host 明示時のみ + 公開対象を名指しした警告必須 | NFR-7 / Mandated / US-19 |
| BR-DS-3 | --host 中は /api/answer を無条件 403（クライアント種別で分岐しない — 判定不能な区別を設けない。ドライバーは本線 or --host 停止後に記入 — ADR-04 の受容、運用ガイドに記載義務） | US-11 / ADR-04 |
| BR-DS-4 | reader の縮退（unsupported/error）を 500 にしない — UI が表示できるペイロードで返す（fail-soft の伝搬 — NFR-6） | NFR-6 |
| BR-DS-5 | 全走査（getMatrix）は**起動時1回のみ**。変更駆動は buildMatrixForUnit の差分更新（性能予算 — reader-core P-RC-2a/2b と同じ分担）。明示再構築エンドポイントは持たない（必要になったら追加 — YAGNI） | NFR-2/3 |
| BR-DS-6 | WS broadcast は全接続クライアントに同一ペイロード（ドライバー/参加者でデータを変えない — read-only 差は書込 API 側で担保） | FR-7.2 |
| BR-DS-7 | atomic write（tmp+rename）・byte-invariance 検証を書込前に実施。検証失敗は 500 で書き込まない | US-14 / C-T2 |

## エラー識別子

`"read-only-mode" | "not-a-questions-file" | "outside-record" | "not-an-answer-line" | "write-verification-failed"`（AnswerWriter）。読取系は reader/bridge の reason をそのまま透過。
