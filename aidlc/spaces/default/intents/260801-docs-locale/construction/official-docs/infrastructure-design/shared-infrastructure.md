# Shared Infrastructure — Unit: official-docs (Bolt 2)

> infrastructure-design / official-docs (library) / 2026-08-02  
> 上流: [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [security-design.md](../nfr-design/security-design.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [performance-design.md](../nfr-design/performance-design.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)

## Shared resources

| Resource | Owner | Consumers |
|----------|-------|-----------|
| `docs/guide\|reference/<locale>/` | Repo content | official-docs via guardPath |
| `docs/official-docs.manifest.json` | Repo | readManifest |
| `@aidlc-guide/core-utils` | shared package | guardPath |
| `@aidlc-guide/shared-types` | shared package | OfficialDocsPage / Toc |
| Root `bun run check` | monorepo | coverage floor binding |

## Not shared / not provisioned

- No AWS accounts, VPC, buckets, CDN  
- No separate deployable for this library  

## Notes

Bolt 2 does not add infrastructure — it tightens check gates and resolve contracts on existing workspace layout.

## Review

**Verdict:** READY — see [cicd-pipeline.md § Review](./cicd-pipeline.md#review).
