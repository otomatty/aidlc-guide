# Performance Design — Unit: docs-shell (Bolt 2)

> nfr-design / docs-shell (ui) / 2026-08-02  
> 上流: [performance-requirements.md](../nfr-requirements/performance-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [business-logic-model.md](../functional-design/business-logic-model.md)

## Requirement → mechanism

| Req ID | Mechanism | Component |
|--------|-----------|-----------|
| P-B2-DS-1 | Locale switch keeps existing lazy-markdown path; UntranslatedNotice is a light conditional mount (no new animation/chart deps) | `UntranslatedNotice`, `DocsShell`, `DocsBody` |
| P-B2-DS-2 | No Bolt 2-specific timing budget; inherit parent app startup NFR | N/A control — review only |

## Explicit non-goals

- No service throughput / autoscaling design (ui unit)
- No CDN / edge cache design (local-only)

## AWS / cloud

N/A — local Tauri/Webview.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02 (re-review)

**Findings:** P-B2-DS-1/2 fully mapped to mechanisms; lazy-markdown path preserved via `DocsBody`/`DocsShell`; component refs (`UntranslatedNotice`, `DocsShell`, `DocsBody`) match frontend-components.md; no invented ms budgets; AWS/cloud correctly N/A; ui kind respected (no scalability/reliability design). Upstream-coverage unreferenced slugs acceptable for performance-only artifact.
