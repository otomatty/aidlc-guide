# Security Design — Unit: docs-shell (Bolt 2)

> nfr-design / docs-shell (ui) / 2026-08-02  
> 上流: [security-requirements.md](../nfr-requirements/security-requirements.md) · [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-requirements.md](../nfr-requirements/scalability-requirements.md) · [reliability-requirements.md](../nfr-requirements/reliability-requirements.md)

## Requirement → mechanism

| Req ID | Mechanism | Component / seam |
|--------|-----------|------------------|
| S-B2-DS-1 | Forbidden imports documented; UI packages must not import `official-docs` / `reader-core`; consume wire DTOs via api-core facade only | package boundaries + Biome / structural tests |
| S-B2-DS-2 | UntranslatedNotice renders **iff** `page.notice === "missing_ja"`; 404 / path_rejected → DocsShell `renderFetchError`, never notice | `UntranslatedNotice` + DocsShell |
| S-B2-DS-3 | Notice root element: `role="status"` (and appropriate `aria-live` if needed by a11y checklist); single region | `UntranslatedNotice` |
| S-B2-DS-4 | Wire types / display strings only in Webview; no FS paths constructed in UI; no secrets | DocsShell props boundary |

## Trust boundary

```text
[Webview UI: docs-shell]
        │ wire PageResult / notice only
        ▼
[api-core pass-through] ──► [official-docs library] ──► FS (guardPath)
```

UI never crosses into FS or library internals.

## AWS / cloud

N/A — local-only (project DECIDED).

## Non-applicable NFR inputs

scalability / reliability requirements are **N/A stubs** for ui kind — no service SLO controls here.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02 (re-review)

**Findings:** S-B2-DS-1..4 each have concrete mechanism + verification seam. Component refs (`UntranslatedNotice`, `DocsShell`) match frontend-components.md; fetch-error via DocsShell `renderFetchError` (never notice) aligns with business-logic-model and ADR-B2-001. Wire-first trust boundary intact; forbidden imports documented with Biome/structural-test enforcement. Scalability/reliability N/A stubs correct for ui kind.
