# Logical Components — Unit: docs-navigation (Bolt 3)

> nfr-design / docs-navigation (ui) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [frontend-components.md](../functional-design/frontend-components.md) · [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [performance-requirements.md](../nfr-requirements/performance-requirements.md)  
> Q4 = A

## Components

Canonical IDs match [frontend-components.md](../functional-design/frontend-components.md).

| Component | Responsibility | Bolt 3 focus |
|-----------|----------------|--------------|
| `OpenOfficialDocLink` | Fetch stage map; build mapped/unmapped payload; post `open-official-doc`; accessible name `Docs: <stageDisplayName>` | US-B3-01/02/05 |
| `StageCard` | Hosts link; removes mapped-path `docsOpenHref` / IDE open | FR-B3-5.1 |
| `handleOpenOfficialDoc` | Host: validate, persist locale, open/front Shell, inject `docsShellDeepLink` | ADR-B3-001 / S-B3-DN-1 |
| `DocsShell` | Consume deep-link incl. required `locale`; one-shot clear | ADR-B3-003 |
| `AnchorApplier` | Reuse Bolt 2 scrolled / top / none | land focus |
| `LocaleControl` | Apply deep-link locale on land (not focus target) | locale continuity |
| Payload types | shared-types mapped / unmapped discriminant | message contract |

## Owned outside this unit (do not re-home)

| Concern | Owner |
|---------|-------|
| `STAGE_DOC_MAP` / `mapStageToDoc` | **official-docs** |
| `GET /api/official-docs/stage/:slug` | **api-core** |
| Markdown / missing_ja notice | Bolt 1–2 Docs Shell |

## Forbidden dependencies

- ✗ `@aidlc-guide/official-docs` in dashboard
- ✗ Mapped StageCard → `open-doc` / `docsOpenHref` / `openExternal`
- ✓ wire types + api-core stage route + existing Shell deep-link

## Diagram

```text
StageCard → OpenOfficialDocLink → GET stage/:slug
                │
                ▼ postMessage open-official-doc
         handleOpenOfficialDoc (validate)
                │
                ▼ inject docsShellDeepLink { locale, path?, anchor? }
         DocsShell → LocaleControl + AnchorApplier
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

Component IDs match frontend-components.md; map ownership stays outside dashboard.
