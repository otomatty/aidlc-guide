# Deployment Strategy — Docs i18n Bolt 2

> deployment-pipeline / 2026-08-02  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [docs-shell deployment-architecture](../../construction/docs-shell/infrastructure-design/deployment-architecture.md) · [docs-shell cicd-pipeline](../../construction/docs-shell/infrastructure-design/cicd-pipeline.md)

## Strategy

| Dimension | Choice |
|-----------|--------|
| Pattern | **Replace-on-install** (extension/VSIX), not blue/green or canary |
| Traffic | N/A — desktop Webview |
| Feature flags | None required for Bolt 2 |
| Smoke | Open Docs Shell → locale switch → missing_ja notice (see extension-manual-scenarios) |

## Promotion

| Env | Meaning | Gate |
|-----|---------|------|
| Local | Developer workspace | `bun run check` (Bolt 2 suites) |
| CI | GHA matrix | check.yml green |
| User machine | Installed extension | Manual smoke / FR-B2-5.2 |

## Review

**Verdict:** READY
