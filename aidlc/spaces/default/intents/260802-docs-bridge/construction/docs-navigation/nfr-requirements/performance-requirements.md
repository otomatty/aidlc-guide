# Performance Requirements — Unit: docs-navigation (Bolt 4)

> nfr-requirements / docs-navigation (ui) / 2026-08-04  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md)  
> Q1 = A · Q4 = A

## Requirements

| ID | 要件 | 検証 |
|----|------|------|
| P-B4-DN-1 | Bridge / StageCard → Open in Docs → Shell is local-only. No runtime network fetch of official docs | NFR-B4-1 / code review |
| P-B4-DN-2 | No Bolt 4-specific ms latency floor for CTA activate or Shell open | Q1=A — wiring Bolt |
| P-B4-DN-3 | Regression: `bun run check` includes excerpt non-mount + CTA→`open-official-doc` tests; Demo Bridge → Shell | FR-B4-3 / NFR-B4-2 |
| P-B4-DN-4 | No new 95% branch-coverage floor (NFR-B4-2) | Policy |
| P-B4-DN-5 | Accept surface = VS Code / Cursor extension Webview only | NFR-B4-3 |

## Notes

UI unit — no service throughput targets. Scalability / reliability N/A (Q5=A).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY

### Checklist

| Check | Result |
|-------|--------|
| NFR-B4-1 local-only / no remote fetch | ✓ P-B4-DN-1 (+ security S-B4-DN-2) |
| NFR-B4-2 check + no new 95% floor | ✓ P-B4-DN-3 / P-B4-DN-4 |
| NFR-B4-3 extension Webview surface | ✓ P-B4-DN-5 |
| No latency floor intentional | ✓ P-B4-DN-2 / Q1=A |
| Scale / reliability N/A for ui | ✓ stubs + Q5=A |
| Upstream sensors | ✓ PASS |

### Findings

- **Advisory:** No ms latency budget — verification is check/Demo-heavy (Q1=A).  
- **Advisory:** Host validate tests owned by Bolt 3 reuse (`S-B4-DN-1`).  
- **Advisory:** unit Kind already aligned to `ui` in unit-of-work.md.
