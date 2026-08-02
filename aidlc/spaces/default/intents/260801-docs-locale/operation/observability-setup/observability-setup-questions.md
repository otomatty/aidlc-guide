# Observability Setup Questions — Docs i18n Bolt 2

> observability-setup / 2026-08-02 · Answers: **recommended**

## Q1. Cloud observability

| Option | Description |
|--------|-------------|
| **A (Recommended)** | None — local-only; no CloudWatch / X-Ray / RUM |
| B | Provision full AWS observability stack |

**Answer:** A

## Q2. What counts as signals

| Option | Description |
|--------|-------------|
| **A (Recommended)** | CI/`bun run check`, vitest Bolt 2 suites, Extension manual scenarios |
| B | Production SLOs with 99.9% targets |

**Answer:** A

## Q3. Alarms

| Option | Description |
|--------|-------------|
| **A (Recommended)** | PR/CI failure is the alarm; no paging stack |
| B | PagerDuty on docs resolve errors |

**Answer:** A

## Completeness

**Answer:** Looks correct and generate
