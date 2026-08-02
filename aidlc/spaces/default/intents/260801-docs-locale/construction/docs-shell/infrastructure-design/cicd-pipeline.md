# CI/CD Pipeline — Unit: docs-shell (Bolt 2)

> infrastructure-design / docs-shell (ui) / 2026-08-02  
> 上流: [security-design.md](../nfr-design/security-design.md) · [logical-components.md](../nfr-design/logical-components.md) · [performance-design.md](../nfr-design/performance-design.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)

## Gates

| Gate | Expectation |
|------|-------------|
| `bun run check` | Biome + tsc + unit tests for Docs Shell Bolt 2 behaviors |
| Notice tests | `notice==="missing_ja"` → UntranslatedNotice; 404 ≠ notice |
| A11y | `role="status"` on notice |
| Boundary | Structural / lint: UI must not import `official-docs` / `reader-core` |
| PR / CI | Existing GitHub Actions — no new workflow required for Bolt 2 |
| Deploy | Extension/VSIX packaging only — no cloud CD |

## Controls

| Control | Design |
|---------|--------|
| Wire-first | Tests assert notice only from resolve wire field |
| S-B2-DS-1 | Import boundary in check |
| P-B2-DS-1 | No new heavy first-paint deps (bundle/review) |

## Cloud / CD

N/A — local-only; release = merge/tag + extension package (project DECIDED).

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02 (architecture re-review)

### Checks passed

- **Single gate:** Primary CI = root `bun run check` (Biome + tsc + vitest + audit), mirrored by `.github/workflows/check.yml` — matches project.md cid:ci-pipeline:c2.
- **No new pipeline:** Existing GitHub Actions sufficient; deploy = extension/VSIX packaging only (local-only).
- **Wire-first / boundary:** S-B2-DS-1 import ban (`official-docs`, `reader-core`) aligns with `packages/dashboard/tests/dependency-direction.test.ts`.
- **Component IDs:** Notice gate names `UntranslatedNotice` + `notice==="missing_ja"`; fetch-error branch is DocsShell `renderFetchError` (never notice) per business-logic-model / S-B2-DS-2.
- **A11y gate:** `role="status"` on notice matches logical-components / frontend-components.
- **Performance control:** P-B2-DS-1 bundle discipline documented; no cloud CD.

### Observations (non-blocking)

- **404 ≠ notice test:** Gate is specified; vitest case for DocsShell `renderFetchError` on 404 is a code-generation obligation (not yet in `docs-shell.test.tsx`). Design contract is implementable without architectural guidance.
- **LocaleControl / DocsBody:** Covered implicitly via existing locale-switch and markdown-surface tests; no separate CI workflow needed.
