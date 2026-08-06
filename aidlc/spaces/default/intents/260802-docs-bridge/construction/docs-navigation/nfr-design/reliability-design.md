# Reliability Design — Unit: docs-navigation (Bolt 4)

> nfr-design / docs-navigation (ui) / 2026-08-04  
> Q5 = A — **N/A stub** (ui; local single-user)  
> 上流: [reliability-requirements.md](../nfr-requirements/reliability-requirements.md) · [business-logic-model.md](../functional-design/business-logic-model.md)

## Status

Not applicable as service SLO design. Degraded paths:

| Failure | Design response |
|---------|-----------------|
| Invalid host payload | Ignore (Bolt 3 reuse) |
| Excerpt present on API | UI omit — not a crash path |
| Map/API error on CTA | No external-browser fallback |

## Review

**Verdict:** READY (N/A)
