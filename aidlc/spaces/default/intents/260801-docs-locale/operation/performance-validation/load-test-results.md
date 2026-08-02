# Load Test Results — Docs i18n Bolt 2

> performance-validation / 2026-08-02  
> 上流: [load-test-plan.md](./load-test-plan.md) · [smoke-test-results.md](../deployment-execution/smoke-test-results.md)

## Results

| Test | Result |
|------|--------|
| k6 / Locust / Artillery | **Not run** (N/A) |
| docs-shell vitest (12) | PASS (~9s wall on this host) |
| official-docs + routes (50) | PASS (~1.5s) |

## Conclusion

No performance regression signal from Bolt 2 automated suites. No service load baseline required.

## Review

**Verdict:** READY
