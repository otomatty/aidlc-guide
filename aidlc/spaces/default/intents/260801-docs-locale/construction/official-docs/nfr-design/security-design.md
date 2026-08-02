# Security Design — Unit: official-docs (Bolt 2)

> nfr-design / official-docs (library) / 2026-08-02  
> 上流: [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [performance-requirements.md](../nfr-requirements/performance-requirements.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md)

## Requirement → mechanism

| Req ID | Mechanism | Module / seam |
|--------|-----------|---------------|
| S-B2-OD-1 | All content reads via `guardPath(localeRoot, rel)` | `roots.ts` + resolve entry |
| S-B2-OD-2 | Escape → Result `path_rejected` (no raw FS throw to UI) | `resolve.ts` / `toc.ts` |
| S-B2-OD-3 | Zero HTTP/network deps in package | package.json / import lint |
| S-B2-OD-4 | `notice: "missing_ja"` only on success-shaped page; never invent from 404 | `resolve.ts` missing_ja branch |
| S-B2-OD-5 | Vitest branch coverage ≥95% on resolve/roots/markdown in `bun run check` | vitest config + check script |
| S-B2-OD-6 | No auth/IdP | N/A by design |

## AWS / cloud

N/A — local-only library (project DECIDED).

## Non-applicable NFR inputs

performance / scalability / reliability requirements are **N/A stubs** for library kind — no service SLO controls to design here.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02

All S-B2-OD-* mapped to mechanisms; AWS N/A; library produces set correct. Cosmetic seam column fixed (`toc.ts`).

