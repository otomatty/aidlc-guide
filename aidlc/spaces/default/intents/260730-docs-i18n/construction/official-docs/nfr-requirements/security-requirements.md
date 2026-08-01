# Security Requirements — Unit: official-docs

> nfr-requirements / official-docs (library) / 2026-07-31  
> 入力: business-rules.md · requirements.md · technology-stack.md

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-OD-1 | すべてのコンテンツ読取は `guardPath` + locale content root | NFR-2 · BR-OD-2 | 否定テスト in `bun run check` |
| S-OD-2 | ルート外パスは `path_rejected`（例外で生 FS しない） | NFR-2 · BR-OD-3 | ベクトル表（core-utils 共有可） |
| S-OD-3 | ライブラリ内でネットワーク I/O 禁止 | NFR-1 · BR-OD-9 | 静的検査 / 依存レビュー |
| S-OD-4 | パス／本文をログに生の秘密として出さない | 一般衛生 | コードレビュー |
| S-OD-5 | branch coverage ≥ 95% on resolve/load module | NFR-3 · BR-OD-8 | Vitest coverage gate |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
