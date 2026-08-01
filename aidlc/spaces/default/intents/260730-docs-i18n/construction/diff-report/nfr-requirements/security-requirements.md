# Security Requirements — Unit: diff-report

> nfr-requirements / diff-report (packaging, Should) / 2026-07-31

| ID | 要件 | 出所 | 検証 |
|----|------|------|------|
| S-DR-1 | レポートに secrets / `.env` を埋め込まない | NFR-6 | 出力スキャン |
| S-DR-2 | Upstream 取得は開発者マシン／CI の明示操作のみ（ランタイム拡張に fetch を入れない） | NFR-1 · Out of scope cloud | 設計レビュー |
| S-DR-3 | 差分出力はリポジトリ相対パスのみ | 衛生 | サンプル出力レビュー |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
