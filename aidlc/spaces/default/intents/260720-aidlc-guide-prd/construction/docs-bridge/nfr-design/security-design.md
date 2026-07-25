# Security Design — Unit: docs-bridge

> nfr-design (3.3) / Unit: docs-bridge / 2026-07-24
> 入力: nfr-requirements/security-requirements.md（S-DB-1〜3）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| S-DB-1（書込ゼロ） | Biome noRestrictedImports（reader-core と同一設定をルート共有 config で） |
| S-DB-2（docs ルート外拒否） | reader-core の `guardPath` 純関数を **shared util として共有**（reader-core Unit が util を shared-types 隣接の共有地点に置くか、docs-bridge が同アルゴリズムを最小複製。ビルド依存を増やさないため**アルゴリズム複製を既定**とし、テストベクタを両 Unit で共通化して等価性を担保） |
| S-DB-3（verbatim・非実行） | 節スライスは文字列操作のみ。eval/Function/import() をコードパスに持たない |

## 信頼境界

bridge-map.json は自パッケージ同梱（信頼データ）。外部入力は slug/term（map キー照合のみ）と config の docsRepoPath（ユーザー自身の設定 — guardPath 検査は防御的多層）。
