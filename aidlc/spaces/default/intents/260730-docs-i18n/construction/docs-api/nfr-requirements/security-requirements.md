# Security Requirements — Unit: docs-api

| ID | 要件 | 検証 |
|----|------|------|
| S-API-1 | No path traversal via URL splat — rely on official-docs guardPath | Negative tests |
| S-API-2 | Do not log full bodies of docs in production paths | Review |
| S-API-3 | Collision ban with `/api/guides` / `/api/docs-settings` | Route registration test |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
