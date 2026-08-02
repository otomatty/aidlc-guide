# Performance Test Instructions — Docs i18n Bolt 2

> build-and-test / 2026-08-02  
> 上流: [docs-shell code-summary](../docs-shell/code-generation/code-summary.md) · [official-docs code-summary](../official-docs/code-generation/code-summary.md)

## Applicability

**N/A for load/stress.** Bolt 2 inherits parent startup NFR; ui unit has no service SLO. Guardrail: no new heavy first-paint deps (P-B2-DS-1) — verified by review / bundle awareness, not a separate perf harness.

## Review

**Verdict:** READY — intentionally N/A beyond dep hygiene.
