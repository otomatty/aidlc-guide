# Security Requirements — Unit: content-snapshot

> nfr-requirements (3.2) / Unit: content-snapshot (kind: packaging) / 2026-07-31  
> 入力: [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../codekb/aidlc-guide/technology-stack.md) · [unit-of-work.md](../../../inception/units-generation/unit-of-work.md)  
> 注: packaging — 実行時攻撃面は薄い。リスクは **同梱内容の衛生** と **秘密の混入**。

## 要件

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-CS-1 | スナップショットに secrets / `.env` / 認証トークンを含めない | NFR-6 · practices package hygiene | VSIX/ツリー grep；CI または `bun run check` 周辺の衛生チェック |
| S-CS-2 | `aidlc/` ランタイム状態・監査シャードを content ツリーに同梱しない | NFR-6 | パッケージ内容レビュー |
| S-CS-3 | 公式 docs 本文のみ（guide/reference）。無関係な社内パスや絶対パス秘密をコミットしない | FR-U1 · Constraints | ツリー path レビュー |
| S-CS-4 | manifest の `source` / `sourceVersion` は追跡用メタのみ（秘密フィールド禁止） | FR-U1.2 | JSON schema 検査 |
| S-CS-5 | 取り込み元 upstream は信頼境界として扱い、実行時 fetch しない（読取はリポジトリ内のみ） | NFR-1 | ランタイムは別 Unit；本 Unit はコミット済み静的ファイルのみ |

## 位置づけ

本 Unit はコンテンツ＋マニフェストの packaging。認証・認可ランタイムは持たない。脅威は「悪いものを VSIX に入れる」こと。

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31

Packaging-scoped security (hygiene + no secrets) matches NFR-6 and local-only constraints. No fabricated cloud controls.
