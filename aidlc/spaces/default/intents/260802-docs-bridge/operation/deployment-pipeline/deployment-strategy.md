# Deployment Strategy — Docs i18n Bolt 4

> deployment-pipeline / 2026-08-05  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [cicd-pipeline.md](../../construction/docs-navigation/infrastructure-design/cicd-pipeline.md)  
> Q1 = A

## Strategy

| Dimension | Choice |
|-----------|--------|
| Pattern | **Replace-on-install** (extension/VSIX), not blue/green or canary |
| Traffic | N/A — desktop Webview |
| Feature flags | None required for Bolt 4 |
| Smoke | Bridge / StageCard → Open in Docs → Docs Shell (demo-record.md) |

## Promotion

| Env | Meaning | Gate |
|-----|---------|------|
| Local | Developer workspace | focused Bolt 4 vitest + tsc |
| CI | GHA matrix | check.yml (timings flake may still fail locally) |
| User machine | Installed extension | Manual demo FR-B4-3.1 |

## Review

**Verdict:** READY
