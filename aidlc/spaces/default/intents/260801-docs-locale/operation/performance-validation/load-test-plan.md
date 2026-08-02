# Load Test Plan — Docs i18n Bolt 2

> performance-validation / 2026-08-02  
> 上流: [docs-shell performance-requirements](../../construction/docs-shell/nfr-requirements/performance-requirements.md) · [performance-design](../../construction/docs-shell/nfr-design/performance-design.md) · [dashboards.md](../observability-setup/dashboards.md)

## Scope

**No distributed load test.** Bolt 2 is local extension Docs Shell + in-process library.

## Proxy checks (instead of load)

| Check | Method |
|-------|--------|
| No new heavy first-paint deps | Code review / package.json (P-B2-DS-1) |
| Resolve latency | Covered by unit tests for correctness, not ms budgets |
| UI smoke duration | vitest docs-shell suite completes in seconds |

## Review

**Verdict:** READY — load plan intentionally empty of cloud tools.
