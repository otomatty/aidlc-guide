# Deployment Architecture — Unit: docs-navigation (Bolt 4)

> infrastructure-design / docs-navigation (ui) / 2026-08-04  
> 上流: [performance-design.md](../nfr-design/performance-design.md) · [security-design.md](../nfr-design/security-design.md) · [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)  
> Q1 = A

## Target runtime

| Layer | Choice |
|-------|--------|
| Host | Existing vscode-extension Webview (NFR-B4-3) |
| UI | StageCard (no excerpt) + OpenOfficialDocLink (`Open in Docs`) |
| Shell land | Existing DocsShell inject (Bolt 3 reuse) |
| Map | api-core stage map (unchanged) |

## Topology

```text
[VS Code / Cursor Extension host]
        │  open-official-doc (validated — reuse)
        ▼ Webview
[StageCard — no docs-excerpt] → [OpenOfficialDocLink]
        │ postMessage
        ▼
[handleOpenOfficialDoc] ──inject──► [DocsShell]
```

## Environments

| Env | Deploy |
|-----|--------|
| Dev | Local bun / extension host |
| CI | Monorepo `bun run check` |
| Prod cloud | **N/A** — local-only |

## Explicit non-goals

- No CDN / cloud deployable / new container  
- No AWS accounts or monitoring stack  

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY
