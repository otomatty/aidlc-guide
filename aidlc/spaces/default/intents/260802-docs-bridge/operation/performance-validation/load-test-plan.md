# Load Test Plan — Docs i18n Bolt 4

> performance-validation / 2026-08-06  
> 上流: [performance-requirements.md](../../construction/docs-navigation/nfr-requirements/performance-requirements.md) · [scalability-requirements.md](../../construction/docs-navigation/nfr-requirements/scalability-requirements.md) · [performance-design.md](../../construction/docs-navigation/nfr-design/performance-design.md) · [scalability-design.md](../../construction/docs-navigation/nfr-design/scalability-design.md) · [dashboards.md](../observability-setup/dashboards.md)  
> Q1 = A

## Scope

**No distributed load test.** Bolt 4 is local Bridge / StageCard → Open in Docs → host → Docs Shell wiring (P-B4-DN-1). No CloudWatch / X-Ray evidence path.

## Proxy checks (instead of load)

| Check | Method |
|-------|--------|
| Local-only open path (no runtime official-docs fetch) | Code review + host/dashboard unit tests (P-B4-DN-1) |
| No Bolt 4 ms budget invented | Design review (P-B4-DN-2) |
| Regression smoke | Focused vitest (51) from [smoke-test-results](../deployment-execution/smoke-test-results.md) (P-B4-DN-3) |
| No new 95% floor | Policy NFR-B4-2 (P-B4-DN-4) |
| Extension Webview surface only | NFR-B4-3 (P-B4-DN-5) |

## Review

**Verdict:** READY — load plan intentionally empty of cloud tools.
