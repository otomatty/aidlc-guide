# CI/CD Pipeline — Unit: docs-navigation (Bolt 4)

> infrastructure-design / docs-navigation (ui) / 2026-08-04  
> 上流: [security-design.md](../nfr-design/security-design.md) · [logical-components.md](../nfr-design/logical-components.md) · [performance-design.md](../nfr-design/performance-design.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)  
> Q2 = A

## Gates

| Gate | Expectation |
|------|-------------|
| `bun run check` | Biome + tsc + tests: excerpt non-mount + CTA→`open-official-doc` |
| Coverage floor | No new 95% branch floor (NFR-B4-2) |
| Boundary | Dashboard ✗ `@aidlc-guide/official-docs` |
| Host | Reuse Bolt 3 validate tests |
| Demo | Manual: Bridge → Open in Docs → Shell (FR-B4-3.1) |
| PR / CI | Existing GitHub Actions — no new workflow |
| Deploy | Extension/VSIX only — no cloud CD |

## Cloud / CD

N/A — release = merge/tag + extension package (worktree + PR → `main`).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY
