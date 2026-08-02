# CI/CD Pipeline — Unit: docs-navigation (Bolt 3)

> infrastructure-design / docs-navigation (ui) / 2026-08-02  
> 上流: [security-design.md](../nfr-design/security-design.md) · [logical-components.md](../nfr-design/logical-components.md) · [performance-design.md](../nfr-design/performance-design.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)  
> Q2 = A

## Gates

| Gate | Expectation |
|------|-------------|
| `bun run check` | Biome + tsc + unit tests covering deep-link payload / map / unmapped→top / no open-doc on mapped path |
| C1–C7 matrix | Must checks from inception (FR-B3-6.1); no new 95% branch floor (NFR-B3-3) |
| Boundary | Dashboard must not import `@aidlc-guide/official-docs` (`dependency-direction.test.ts`) |
| Host validate | Invalid locale / empty mapped path → ignore (no Shell inject) |
| Demo | Manual: intent-capture StageCard → Docs Shell (FR-B3-6.2); not a new CI Must |
| PR / CI | Existing GitHub Actions — no new workflow for Bolt 3 |
| Deploy | Extension/VSIX packaging only — no cloud CD |

## Controls

| Control | Design |
|---------|--------|
| S-B3-DN-1 | Host validation tests |
| S-B3-DN-3 | Mapped path forbids `open-doc` / `docsOpenHref` |
| S-B3-DN-4 | Import boundary in check |
| P-B3-DN-1 | No runtime remote official-docs fetch |

## Cloud / CD

N/A — local-only; release = merge/tag + extension package.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

Q2=A / Q4=A: existing `bun run check` only; no new workflow; no cloud CD / monitoring.
