# Frontend Components — Unit: docs-shell (Bolt 2)

> functional-design / docs-shell (ui) / 2026-08-02  
> 上流: [business-logic-model.md](./business-logic-model.md) · [mockups](../../../inception/refined-mockups/mockups.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [components.md](../../../inception/application-design/components.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [services.md](../../../inception/application-design/services.md)

## Component map

| Component | Role | Props / state (high level) |
|-----------|------|----------------------------|
| DocsShell | Layout: header + TOC + main | locale, path, page, toc |
| LocaleControl | en/ja toggle | `localeRequested`; aria-current on active |
| UntranslatedNotice | Static banner | shown iff `notice==="missing_ja"`; `role="status"` |
| DocsToc | Tree | highlight path if in toc |
| DocsBody | Markdown surface | bodyMarkdown; h1 Should (US-B2-S1) |
| AnchorApplier | effect | scrolled→heading; top→h1; none→noop |

## Interaction

| Event | Behavior |
|-------|----------|
| Locale click | U1 setLocale |
| TOC click | load path; keep locale |
| Fetch error | not_found / rejected / empty UI — no notice |

## A11y

- Notice: live region `role="status"`  
- Focus after switch per Q3 refined mockups (heading or h1)  
- Color not sole signal for notice

## Review

**Verdict:** READY — see [business-logic-model.md § Review](./business-logic-model.md#review).
