# Performance Design — Unit: docs-navigation (Bolt 3)

> nfr-design / docs-navigation (ui) / 2026-08-02  
> 上流: [performance-requirements.md](../nfr-requirements/performance-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [business-logic-model.md](../functional-design/business-logic-model.md)  
> Q1 = A

## Requirement → mechanism

| Req ID | Mechanism | Component |
|--------|-----------|-----------|
| P-B3-DN-1 | Local postMessage → host → Shell inject; no runtime official-docs network fetch | `OpenOfficialDocLink`, `handleOpenOfficialDoc`, `DocsShell` |
| P-B3-DN-2 | No Bolt 3 ms budget / timing harness Must | N/A control — review only |
| P-B3-DN-3 | Regression via existing `bun run check` + manual demo (intent-capture StageCard) | verify / demo-record |
| P-B3-DN-4 | No new 95% branch floor; rely on C1–C7 matrix | policy — NFR-B3-3 |

## Explicit non-goals

- No service throughput / autoscaling design (ui unit)
- No CDN / edge cache (local-only extension)
- No Shell-open latency instrumentation as Must

## AWS / cloud

N/A — local VS Code / Cursor Webview (NFR-B3-2).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

P-B3-DN-1…4 mapped; no invented ms budgets; AWS N/A.
