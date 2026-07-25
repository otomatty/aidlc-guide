# Reliability Design — Unit: dashboard-server

> nfr-design (3.3) / Unit: dashboard-server / 2026-07-24
> 入力: nfr-requirements/reliability-requirements.md（R-DS-1〜5）+ functional-design

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| R-DS-1（縮退透過） | ReadResult→HTTP 写像を mapResult() ヘルパー1箇所に集約（unsupported/error→200+ペイロード、outside-record→403、artifact-not-found→404、no-active-intent→200+empty）。ハンドラ個別に写像を書かない |
| R-DS-2（atomic+検証） | AnswerWriter: バイト構築→検証→tmp 書き→rename。**tmp は書込先と同一ディレクトリに `.answer-tmp-<pid>` 名で作成**（R-DS-5 どおり — EXDEV 回避のため OS temp は使わない）。成功/失敗とも finally で unlink するため残骸は原則残らない（クラッシュ残骸は次回書込時に同名上書き。起動時掃除はしない — 掃除自体が aidlc 配下への操作になるため最小限に留める） |
| R-DS-3（WS 復帰） | 接続管理は Set のみ（セッション状態なし）。切断は Set から除去。再接続クライアントは REST から取り直す（サーバは何も覚えない — 状態レス設計が復帰性そのもの） |
| R-DS-4（dist の扱い） | 起動シーケンス step1（functional-design）。**現段階（dashboard-ui 未出荷）は API-only モード + 明示ログ**、出荷後に fail-fast へ切替（要件側の段階規定どおり — code-generation D-1）。切替点は `static.ts` の dist 解決1箇所 |
| R-DS-5（rename 競合） | EPERM 時 50ms backoff 1回再試行 → 失敗は 500 + 元ファイル無傷（nfr-requirements の規定どおり） |

## 補足

`.answer-tmp-*` は aidlc 配下への一時ファイル作成であり NFR-1 の「書き込まない」原則の例外に見えるが、**FR-6.2 の許可された書込の実装詳細**（atomic 化のための同一ディレクトリ tmp）として整理する。作成〜rename/unlink は単一リクエスト内で完結し、残骸は次回書込時に上書きされる。reader-core の watch はこの tmp を `matrix:` scope で拾い得るが、即座に消えるため reader-core の debounce 設計（functional-design L5: ディレクトリ粒度 300ms — reader-core/functional-design/business-logic-model.md）内で吸収される。
