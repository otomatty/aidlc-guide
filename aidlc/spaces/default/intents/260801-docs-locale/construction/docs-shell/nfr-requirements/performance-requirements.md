# Performance Requirements — Unit: docs-shell (Bolt 2)

> nfr-requirements / docs-shell (ui) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md)

## Requirements

| ID | 要件 | 検証 |
|----|------|------|
| P-B2-DS-1 | Locale switch uses existing lazy-markdown path; no new heavy first-paint deps | Code review / bundle |
| P-B2-DS-2 | No Bolt 2-specific ms budget beyond parent NFR-2 app startup | Inherited |

## Notes

UI unit — no service throughput targets.

## Review

**Verdict:** READY
