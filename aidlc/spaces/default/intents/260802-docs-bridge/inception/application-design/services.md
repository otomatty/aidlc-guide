# Services — Docs i18n Bolt 4

> Intent: `260802-docs-bridge` · application-design · 2026-08-03  
> Q4 = A — **AWS / cloud services: N/A**

## Runtime services (local)

| Service | Role in Bolt 4 | Change |
|---------|----------------|--------|
| vscode-extension host (in-process api-core) | Handles `open-official-doc`; serves Dashboard | Reuse |
| Docs Shell (webview UI) | Canonical doc viewer | Reuse land |
| `/api/stage/:slug` (api-core) | May still return excerpt | UI ignores mount |
| `/api/official-docs/*` | Shell content | Unchanged |

## New services

**None.** No new daemons, queues, or cloud resources.

## Communication

| From | To | Pattern |
|------|-----|---------|
| dashboard CTA | extension host | sync postMessage `open-official-doc` |
| host | Docs Shell | existing deep-link inject |

No REST/gRPC/event bus additions for Bolt 4.
