# Performance Requirements — Unit: docs-navigation (Bolt 3)

> nfr-requirements / docs-navigation (ui) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md)  
> Q1 = A · Q4 = A

## Requirements

| ID | 要件 | 検証 |
|----|------|------|
| P-B3-DN-1 | Deep-link open is local-only (webview → host → Shell). No runtime network fetch of official docs | Code review / NFR-B3-1 |
| P-B3-DN-2 | No Bolt 3-specific ms latency floor for Shell open or StageCard activate | Inherited — wiring Bolt |
| P-B3-DN-3 | Regression: `bun run check` + manual demo (intent-capture StageCard → Docs Shell) | FR-B3-6.1 / FR-B3-6.2 |
| P-B3-DN-4 | No new 95% branch-coverage floor for deep-link path (NFR-B3-3) | Policy — check matrix C1–C7 |

## Notes

UI unit — no service throughput or multi-user concurrency targets. Scalability / reliability N/A (Q5 = A).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

**Non-blocking:** C1–C7 matrix IDs deferred to verify/demo artifacts (LOW); no latency floor intentional (Q1=A).
