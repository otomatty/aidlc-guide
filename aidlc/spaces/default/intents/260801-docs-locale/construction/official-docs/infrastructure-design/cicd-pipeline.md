# CI/CD Pipeline — Unit: official-docs (Bolt 2)

> infrastructure-design / official-docs (library) / 2026-08-02  
> 上流: [security-design.md](../nfr-design/security-design.md) · [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [performance-design.md](../nfr-design/performance-design.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)

## Gates

| Gate | Expectation |
|------|-------------|
| `bun run check` | Tests + **branch coverage ≥95%** on `resolve.ts` / `roots.ts` / `markdown.ts` + Biome + tsc |
| PR / CI | Same check via existing GitHub Actions |
| Deploy | None — library in-process via api-core / VSIX |

## Controls

| Control | Design |
|---------|--------|
| Path traversal negatives | Remain in check suite (S-B2-OD-1/2) |
| No network deps | Package dependency review |
| Coverage floor fail | check fails if below 95% (NFR-B2-1) |

## Cloud / CD

N/A — local-only; release = merge/tag to main (project DECIDED).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02

Library CI = check + coverage floor; no deployables. Consumes N/A stubs acknowledged.
