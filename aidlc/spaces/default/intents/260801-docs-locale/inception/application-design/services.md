# Services — Docs i18n Bolt 2

> ステージ: application-design / 2026-08-01  
> 上流: [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md) · [components.md](./components.md)  
> クラウド／AWS: 対象外（project DECIDED / Q4=A）。

## Service view (logical)

新規マイクロサービスなし。既存 in-process 経路の **契約完了** のみ。

| Logical service | Implementation | Bolt 2 responsibility | Lifecycle |
|-----------------|----------------|----------------------|-----------|
| OfficialDocsRead | api-core + official-docs | keep-path / missing_ja / anchorApplied on sync GET | Process-local |
| DocsShellSession | dashboard + extension | Locale control, notice banner, focus after switch | Webview + workspaceState |
| CoverageGate | `bun run check` | NFR-B2-1 branch floor on resolve/roots/markdown | Dev/CI |

## Orchestration

**Sync request/response** (not events):

```text
User → dashboard Docs Shell → (postMessage) vscode-extension → api-core → official-docs → FS
                            ← OfficialDocsPage ←
```

Locale switch and initial load share this path. No message bus.

## Communication contracts

| From | To | Pattern | Contract |
|------|-----|---------|----------|
| dashboard | extension / api-core | Sync GET-shaped | `/api/official-docs/:locale/*` → `OfficialDocsPage` |
| api-core | official-docs | In-process sync | `resolvePage` / `listToc` / manifest |
| official-docs | core-utils | Sync call | `guardPath` |

## Scaling / HA

N/A — single-user local IDE (NFR-B2-3 surface).

## AWS / cloud mapping (platform voice)

| Concern | Decision |
|---------|----------|
| Hosting / CDN / S3 | None |
| AuthN/Z cloud | N/A |
| Observability SaaS | N/A |

## Out of Must surface

| Path | Bolt 2 |
|------|--------|
| dashboard-server browser | Not Fail (Q4=A) |
| mcp-server official-docs tools | Not required |

## Review

**Verdict:** READY — see full review in [components.md § Review](./components.md#review).

Communication contracts table now matches: `resolvePage / listToc / manifest` is backed by the `listToc` method added to component-methods.md. `GET /api/official-docs/toc/:locale` endpoint is consistent with the single-monolith Q4=A decision. No structural issues.
