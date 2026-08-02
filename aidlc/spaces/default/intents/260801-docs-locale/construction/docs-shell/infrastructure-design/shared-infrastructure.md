# Shared Infrastructure — Unit: docs-shell (Bolt 2)

> infrastructure-design / docs-shell (ui) / 2026-08-02  
> 上流: [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [security-design.md](../nfr-design/security-design.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [performance-design.md](../nfr-design/performance-design.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)

## Shared resources

| Resource | Owner | docs-shell use |
|----------|-------|----------------|
| api-core docs facade | monorepo | Wire PageResult / locale / notice |
| `@aidlc-guide/shared-types` | shared package | Wire DTOs only |
| Existing MarkdownSurface / lazy-markdown | dashboard | DocsBody |
| vscode-extension Webview host | packaging | Runtime (NFR-B2-3) |
| Root `bun run check` | monorepo | UI + boundary gates |

## Not shared / not provisioned

- No AWS accounts, VPC, buckets, CDN  
- No direct FS or `official-docs` package from UI  
- No new monitoring stack  

## Notes

Bolt 2 docs-shell reuses existing host and check gates; infrastructure change is contractual (wire + forbidden imports), not new cloud resources.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02 (architecture re-review)

### Checks passed

- **Shared resources resolve:** api-core facade, `@aidlc-guide/shared-types`, MarkdownSurface/lazy-markdown (DocsBody logical ID), vscode-extension Webview (NFR-B2-3), and root `bun run check` all exist in monorepo.
- **Forbidden paths:** No AWS/VPC/buckets; no direct FS or `official-docs` from UI — consistent with S-B2-DS-1 and components.md boundary.
- **No new monitoring stack:** Correct for ui `produces_kinds` (monitoring-design not required).
- **Contractual change only:** Infrastructure delta is wire + import boundaries, not new cloud provisioning.

### Observations (non-blocking)

- **DocsBody physical mapping:** Logical `DocsBody` renders via `MarkdownSurface` inside `DocsShell` (no standalone `DocsBody` module) — mapping in Shared resources table is accurate for implementers.
