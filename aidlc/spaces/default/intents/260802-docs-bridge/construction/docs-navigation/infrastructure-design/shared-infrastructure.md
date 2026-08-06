# Shared Infrastructure — Unit: docs-navigation (Bolt 4)

> infrastructure-design / docs-navigation (ui) / 2026-08-04  
> 上流: [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [security-design.md](../nfr-design/security-design.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [performance-design.md](../nfr-design/performance-design.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)  
> Q3 = A

## Shared resources

| Resource | Owner | Bolt 4 use |
|----------|-------|------------|
| `open-official-doc` host handler | vscode-extension | **Reuse** — CTA land |
| DocsShell deep-link | dashboard (Bolt 3) | Shell open |
| Stage map API | api-core / official-docs | CTA payload build |
| Root `bun run check` | monorepo | non-mount + CTA tests |
| excerpt on wire (optional) | docs-bridge | UI ignores (ADR-B4-002) |

## Not provisioned

- No AWS / VPC / CDN / BFF  
- No new monitoring stack  
- No new packages  

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY
