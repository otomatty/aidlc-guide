# Deployment Architecture — Unit: docs-navigation (Bolt 3)

> infrastructure-design / docs-navigation (ui) / 2026-08-02  
> 上流: [performance-design.md](../nfr-design/performance-design.md) · [security-design.md](../nfr-design/security-design.md) · [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)  
> Q1 = A

## Target runtime

| Layer | Choice |
|-------|--------|
| Host | Existing vscode-extension Webview (NFR-B3-2 Must) |
| UI | Dashboard StageCard / OpenOfficialDocLink — changes in place |
| Shell land | Existing DocsShell deep-link inject (Bolt 2) |
| Map | api-core `GET /api/official-docs/stage/:slug` → official-docs (in-process) |

## Topology

```text
[VS Code / Cursor Extension host]
        │  open-official-doc (validated)
        ▼ Webview
[StageCard / OpenOfficialDocLink] ──GET stage/:slug──► [api-core] ──► [official-docs map]
        │ postMessage
        ▼
[handleOpenOfficialDoc] ──inject──► [DocsShell + AnchorApplier]
```

## Environments

| Env | Deploy |
|-----|--------|
| Dev | Local `bun` / extension host |
| CI | Monorepo `bun run check` (no remote UI host) |
| Prod cloud | **N/A** — local-only |

## Explicit non-goals

- No CDN, S3, CloudFront, or separate docs site deployable
- No new container / K8s / BFF for deep-link
- No cloud monitoring stack

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

Q1=A reflected; no cloud deployable; topology matches BLM / logical-components.
