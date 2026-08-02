# Deployment Strategy — Docs i18n Bolt 3

> deployment-pipeline / 2026-08-02  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [cicd-pipeline.md](../../construction/docs-navigation/infrastructure-design/cicd-pipeline.md)  
> Q1 = A

## Strategy

| Dimension | Choice |
|-----------|--------|
| Pattern | **Replace-on-install** (extension/VSIX), not blue/green or canary |
| Traffic | N/A — desktop Webview |
| Feature flags | None required for Bolt 3 |
| Smoke | intent-capture StageCard → Docs Shell land (see demo-record.md) |

## Promotion

| Env | Meaning | Gate |
|-----|---------|------|
| Local | Developer workspace | focused Bolt 3 vitest + tsc |
| CI | GHA matrix | check.yml (timings flake may still fail locally) |
| User machine | Installed extension | Manual demo FR-B3-6.2 |

## Review

**Verdict:** READY
