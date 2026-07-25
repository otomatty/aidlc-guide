# Security Design — Unit: reader-core

> nfr-design (3.3) / Unit: reader-core / 2026-07-24
> 入力: nfr-requirements/security-requirements.md（S-RC-1〜4）+ functional-design/business-logic-model.md L6

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| S-RC-1（書込ゼロ） | import は `node:fs/promises` の {readFile, readdir, stat, realpath} と chokidar のみ。Biome `noRestrictedImports` で write 系（writeFile/appendFile/mkdir/rm/rename…）を全パッケージ内禁止に設定 |
| S-RC-2（読取境界） | L6 アルゴリズムを `guardPath(recordDir, relPath): ReadResult<string>` 純関数に分離（readArtifact 専用でなく再利用可能に。テストは関数単体で3ベクタ+誤許可ケース） |
| S-RC-3（本文非保持・非漏洩） | エラー組立は `reason` 列挙値 + パスのみを受けるヘルパーに集約（本文を渡せない型） |
| S-RC-4（読取 bound） | `readBounded(path, max=10MB)` ヘルパー1箇所に stat → 超過拒否 → read を集約（readState / readArtifact / audit シャード読取がこれを使う） |

## 信頼境界

reader-core は「ローカル FS のワークスペース（半信頼 — 壊れ得るが敵性までは想定しない）」を読む純ライブラリ。唯一の外部由来入力は readArtifact の relPath（MCP/HTTP 経由でユーザー入力が届く）— guardPath が一次防衛、呼出側で二重化。
