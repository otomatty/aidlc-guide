# Domain Entities — Unit: official-docs (Bolt 2)

> functional-design / official-docs (library) / 2026-08-02  
> 上流: [component-methods.md](../../../inception/application-design/component-methods.md) · [components.md](../../../inception/application-design/components.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [services.md](../../../inception/application-design/services.md) · [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md)  
> Aligns with `OfficialDocsPage` / `OfficialDocsToc` in shared-types — no rename.

## Entities

### Locale

`"en" | "ja"` only.

### DocPath

Relative path under locale content root; keep-path invariant: identity preserved across locale switches.

### ResolvedPage → OfficialDocsPage

| Field | Type | Bolt 2 note |
|-------|------|-------------|
| localeRequested | Locale | User/control intent |
| localeServed | Locale | May be `en` when notice set |
| path | DocPath | **Always** request path |
| bodyMarkdown | string | en body when missing_ja |
| title | string? | Optional |
| notice | `"missing_ja"`? | Only missing_ja value |
| sourceVersion | string | From manifest |
| anchorApplied | `"scrolled" \| "top" \| "none"` | FR-B2-3 |

### OfficialDocsToc

Locale-scoped tree nodes `{ id, title, path, children[] }`. Highlight ownership is UI (`docs-shell`), not this entity.

### Manifest

Unchanged: `sourceVersion`, `source`, `capturedAt`.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY — see full review in [business-logic-model.md § Review](./business-logic-model.md#review).

Entities and relationships are correct: Locale, DocPath, ResolvedPage, OfficialDocsToc, Manifest all align with shared-types contracts; keep-path invariant on DocPath and anchorApplied enum are correct. No defects.

---

## Relationships

```text
Manifest ──provides──► ResolvedPage.sourceVersion
DocPath + Locale ──input──► resolvePage / listToc
ResolvedPage.notice ──signals──► UI (docs-shell; not owned here)
```
