# Security Requirements — Unit: docs-bridge

> nfr-requirements (3.2) / Unit: docs-bridge / 2026-07-24
> 入力: functional-design/business-rules.md（BR-DB-1〜6）+ requirements.md（NFR-1）

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| S-DB-1 | 書込 API ゼロ（read 系のみ。Biome restricted-imports — reader-core と同設定） | lint + import 走査 |
| S-DB-2 | docs 本文の読取は docsRepoPath 配下に限定（設定されたルート外の docPath は拒否 — 対応表は自データだが防御的に検査。reader-core の guardPath 相当を自前で最小実装 or 共有 util） | パス検査テスト |
| S-DB-3 | excerpt は verbatim 抜粋のみ（BR-DB-2）— 実行・評価しない（Markdown をコードとして扱わない） | 設計検査 |

## 非該当

認証・ネットワークなし。ユーザー入力は slug/term 文字列のみ（map キー照合に使うだけで、パス組み立てに使わない）。
