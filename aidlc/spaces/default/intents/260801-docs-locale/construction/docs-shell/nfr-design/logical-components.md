# Logical Components — Unit: docs-shell (Bolt 2)

> nfr-design / docs-shell (ui) / 2026-08-02  
> 上流: [business-logic-model.md](../functional-design/business-logic-model.md) · [frontend-components.md](../functional-design/frontend-components.md) · [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [performance-requirements.md](../nfr-requirements/performance-requirements.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md)

## Components

Canonical IDs match [frontend-components.md](../functional-design/frontend-components.md).

| Component | Responsibility | Bolt 2 focus |
|-----------|----------------|--------------|
| `DocsShell` | Layout: header + TOC + main; routes page / notice / fetch-error branches | keep-path switch UX |
| `LocaleControl` | en/ja toggle; emits `localeRequested`; does not resolve content | keep-path |
| `UntranslatedNotice` | Static banner iff `notice==="missing_ja"`; `role="status"` | FR-B2-2.3 / S-B2-DS-2..3 |
| `DocsToc` | Tree; highlight path if in toc | path continuity |
| `DocsBody` | Markdown surface (lazy path); h1 Should (US-B2-S1) | P-B2-DS-1 |
| `AnchorApplier` | effect: scrolled→heading; top→h1; none→noop | FR-B2-1.x |

## Fetch-error UI (not a separate component ID)

Fetch error (`not_found` / `rejected` / `empty`) is rendered by **DocsShell** branch `renderFetchError` — **not** UntranslatedNotice (ADR-B2-001 / S-B2-DS-2).

## Forbidden dependencies

- ✗ `official-docs`
- ✗ `reader-core` (direct)
- ✓ wire types + api-core facade / existing dashboard docs hooks only

## Diagram

```text
LocaleControl → DocsShell → (notice?) UntranslatedNotice
                          → (ok) DocsBody + AnchorApplier
                          → (err) renderFetchError  ← no notice
                          → DocsToc
                │
                ▼ wire only
             api-core → official-docs
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02 (re-review)

**Findings:** Component IDs match [frontend-components.md](../functional-design/frontend-components.md): `DocsShell`, `LocaleControl`, `UntranslatedNotice`, `DocsToc`, `DocsBody`, `AnchorApplier`. Fetch error is DocsShell `renderFetchError` branch (not a separate component ID). Forbidden deps and wire-only seam match S-B2-DS-1 / business-logic-model. No invented IDs (`LocaleSwitcher` / `DocContentView` / `DocErrorView` absent).
