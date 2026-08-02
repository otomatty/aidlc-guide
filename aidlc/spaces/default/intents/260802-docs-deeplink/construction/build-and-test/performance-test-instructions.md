# Performance Test Instructions — Docs i18n Bolt 3

> build-and-test / 2026-08-02  
> 上流: [performance-requirements](../docs-navigation/nfr-requirements/performance-requirements.md) · [code-summary](../docs-navigation/code-generation/code-summary.md)

## Status

**N/A / hygiene only** — P-B3-DN-2: no Bolt 3 ms latency floor. Local postMessage path; no load harness.

## Verification

- Code review: no new heavy first-paint deps on StageCard path
- Regression: focused vitest + (when green) `bun run check`

## Review

**Status:** N/A
