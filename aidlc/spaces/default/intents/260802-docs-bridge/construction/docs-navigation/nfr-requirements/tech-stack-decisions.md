# Tech Stack Decisions — Unit: docs-navigation (Bolt 4)

> nfr-requirements / docs-navigation (ui) / 2026-08-04  
> 上流: [technology-stack.md](../../../../../codekb/aidlc-guide/technology-stack.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [business-rules.md](../functional-design/business-rules.md)  
> Q3 = A

## Decisions

| Decision | Choice |
|----------|--------|
| Language / runtime | Existing TypeScript + bun |
| UI | Existing React / Vite dashboard (`StageCard`, `OpenOfficialDocLink`) |
| Host | Existing vscode-extension `open-official-doc.ts` (**reuse**) |
| Map / API | Existing official-docs stage map + api-core (unchanged) |
| Shell landing | Existing Docs Shell deep-link (Bolt 3) |
| New deps / packages | **None** |

## Explicit non-choices

| Rejected | Why |
|----------|-----|
| New host message type / adapter | ADR-B4-001 |
| Delete excerpt from API as Must | ADR-B4-002 — UI-only |
| Browser Dashboard as accept surface | NFR-B4-3 |
| Cloud / AWS | project Forbidden |
| New 95% coverage floor | NFR-B4-2 |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY
