# Logical Components — Unit: docs-navigation (Bolt 4)

> nfr-design / docs-navigation (ui) / 2026-08-04  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [frontend-components.md](../functional-design/frontend-components.md) · [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [performance-requirements.md](../nfr-requirements/performance-requirements.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md)  
> Q4 = A

## Components

| Component | Responsibility | Bolt 4 focus |
|-----------|----------------|--------------|
| `StageCard` | Omit `docs-excerpt` Accordion even when excerpt present | US-B4-01 / FR-B4-1 |
| `OpenOfficialDocLink` | Label/aria `Open in Docs`; solid primary; emit `open-official-doc` | US-B4-02 / FR-B4-2.4 |
| `handleOpenOfficialDoc` | Host validate + Shell inject — **reuse** Bolt 3 | ADR-B4-001 |
| `DocsShell` / `AnchorApplier` | Unchanged land path | inherit Bolt 3 |
| Optional aids | May remain; must not restore excerpt article | US-B4-S1 |

## Owned outside this unit

| Concern | Owner |
|---------|-------|
| STAGE_DOC_MAP / stage API | official-docs / api-core |
| excerpt field on wire | docs-bridge (may remain — ADR-B4-002) |
| Shell content / locale resolve | Bolt 1–2 |

## Forbidden

- ✗ Mount excerpt as article on Extension StageCard / Bridge  
- ✗ New host message type  
- ✗ `@aidlc-guide/official-docs` in dashboard  
- ✗ IDE primary path → openExternal / open-doc  

## Diagram

```text
StageCard (no excerpt)
  → OpenOfficialDocLink ("Open in Docs", solid)
       → GET /api/official-docs/stage/:slug
       → postMessage open-official-doc
            → handleOpenOfficialDoc (reuse)
                 → DocsShell land
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY
