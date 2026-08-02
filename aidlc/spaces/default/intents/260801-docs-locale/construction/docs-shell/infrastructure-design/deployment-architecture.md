# Deployment Architecture — Unit: docs-shell (Bolt 2)

> infrastructure-design / docs-shell (ui) / 2026-08-02  
> 上流: [performance-design.md](../nfr-design/performance-design.md) · [security-design.md](../nfr-design/security-design.md) · [logical-components.md](../nfr-design/logical-components.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [business-logic-model.md](../functional-design/business-logic-model.md) · [scalability-design.md](../nfr-design/scalability-design.md) · [reliability-design.md](../nfr-design/reliability-design.md)

## Target runtime

| Layer | Choice |
|-------|--------|
| Host | Existing vscode-extension Webview (NFR-B2-3 Must) |
| UI package | Dashboard Docs Shell (React / Vite) — Bolt 2 changes in place |
| Content path | Wire → api-core → official-docs (in-process); UI never deploys content |

## Topology

```text
[VS Code Extension host]
        │
        ▼ Webview
[docs-shell UI] ──wire──► [api-core] ──► [official-docs] ──► local FS docs/
```

## Environments

| Env | Deploy |
|-----|--------|
| Dev | Local `bun` / extension host |
| CI | Package build via monorepo check (no remote UI host) |
| Prod cloud | **N/A** — local-only (project DECIDED) |

## Explicit non-goals

- No CDN, S3, CloudFront, or separate docs site deployable
- No new container / K8s service for Docs Shell

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-02 (architecture re-review)

### Checks passed

- **NFR-B2-3 / host:** Existing vscode-extension Webview is the sole Must runtime; no browser/CDN deployable introduced.
- **Local-only / no AWS:** Prod cloud N/A; explicit non-goals reject CDN, S3, CloudFront, containers — aligned with project DECIDED and services.md.
- **Wire-first topology:** UI → api-core → official-docs → local FS matches inception components.md boundary (`dashboard ✗ official-docs`).
- **ui `produces_kinds`:** Only deployment-architecture (+ cicd-pipeline, optional shared-infrastructure) produced; infrastructure-services and monitoring-design correctly omitted.
- **Upstream coverage:** Stage union references all eight consumes (sensor pass).

### Observations (non-blocking)

- Logical component IDs (`LocaleControl`, `DocsBody`, etc.) live in functional/nfr design; deployment doc correctly stays at runtime topology — no ID mismatch.
