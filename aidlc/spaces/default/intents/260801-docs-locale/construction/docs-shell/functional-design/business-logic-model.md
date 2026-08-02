# Business Logic Model — Unit: docs-shell (Bolt 2)

> functional-design / docs-shell (ui) / 2026-08-02  
> 上流: [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [components.md](../../../inception/application-design/components.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [services.md](../../../inception/application-design/services.md)

## Prior unit ownership (do not re-spec)

| Behavior | Owner |
|----------|-------|
| keep-path / missing_ja / anchorApplied on resolve | **official-docs** |
| OfficialDocsPage field names | **shared-types** |
| HTTP pass-through | **api-core** |

This unit owns **display + focus + TOC highlight + extension acceptance surface**.

## Flows

### U1 — setLocale

```text
user toggles LocaleControl
  → GET official-docs page for (locale, current path, anchor?)
  → on 200 OfficialDocsPage: render body; syncLocaleControl(localeRequested);
       renderNotice iff notice==="missing_ja"; applyAnchor; syncTocHighlight(toc, path)
  → on 404/400/503: renderFetchError — never missing_ja banner
```

### U2 — initial load / TOC select

Same wire consume rules as U1.

## Invariants

- Never import `@aidlc-guide/official-docs`  
- Never infer untranslated from HTTP status  
- Locale control shows `localeRequested`, not `localeServed`

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02

Prior-unit ownership table present; wire-only UI; 404≠missing_ja.
