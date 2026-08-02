# Shared Infrastructure — Unit: docs-navigation (Bolt 3)

> infrastructure-design / docs-navigation (ui) / 2026-08-02  
> 上流: [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [security-design.md](../nfr-design/security-design.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [performance-design.md](../nfr-design/performance-design.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)  
> Q3 = A

## Shared resources

| Resource | Owner | docs-navigation use |
|----------|-------|---------------------|
| `GET /api/official-docs/stage/:slug` | api-core | Stage map lookup (no dashboard→official-docs import) |
| `STAGE_DOC_MAP` / mapStageToDoc | official-docs | Map ownership (unchanged 7 slugs) |
| `@aidlc-guide/shared-types` | shared package | `open-official-doc` payload types |
| DocsShell / AnchorApplier / LocaleControl | dashboard (Bolt 1–2) | Deep-link land |
| vscode-extension Webview host | packaging | `handleOpenOfficialDoc` |
| Root `bun run check` | monorepo | UI + boundary + unit gates |

## Not shared / not provisioned

- No AWS accounts, VPC, buckets, CDN  
- No new BFF or cloud map service  
- No direct FS / `official-docs` package from dashboard  
- No new monitoring stack  

## Notes

Bolt 3 infrastructure change is contractual (message type + host handler + StageCard wire), not new cloud resources.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

Q3=A reflected; reuse api-core + shared-types + host/Shell; no new BFF/cloud.
