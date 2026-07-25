# Scalability Design — Unit: reader-core

> nfr-design (3.3) / Unit: reader-core / 2026-07-24
> 入力: nfr-requirements/scalability-requirements.md（SC-RC-1〜3）

## 設計

| 要件 | 実現機構 |
|------|---------|
| SC-RC-1/2（600→1200ファイルで線形以下） | 全走査アルゴリズムが O(n)（performance-design の単一パス・tail 読み）。ソートは audit マージ（O(n log n)、n=イベント数）と一覧の名前ソートのみ |
| SC-RC-3（インテント/スペース列挙） | readdir 1回ずつ。ネスト走査しない |

## 非該当（要件どおり）

同時ユーザー・分散は構造的非該当（scalability-requirements.md）。消費者2プロセス（mcp/dashboard-server）は各自独立の Reader インスタンスで読むだけ — 共有状態・ロック不要（ファイルが唯一の真実 — services.md）。
