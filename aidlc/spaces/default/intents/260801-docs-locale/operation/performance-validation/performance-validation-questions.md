# Performance Validation Questions — Docs i18n Bolt 2

> performance-validation / 2026-08-02 · Answers: **recommended**

## Q1. Load testing

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Skip k6/locust — no service SLO; local Webview only |
| B | Run synthetic load against a docs API |

**Answer:** A

## Q2. What to validate

| Option | Description |
|--------|-------------|
| **A (Recommended)** | P-B2-DS-1 no new heavy deps + existing vitest smoke duration acceptable |
| B | Invent LCP budgets for Docs Shell |

**Answer:** A

## Q3. Scalability NFR

| Option | Description |
|--------|-------------|
| **A (Recommended)** | N/A stubs already — mark validated as not applicable |
| B | Horizontal scale plan |

**Answer:** A

## Completeness

**Answer:** Looks correct and generate
