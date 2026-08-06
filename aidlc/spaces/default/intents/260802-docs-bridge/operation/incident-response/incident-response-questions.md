# Incident Response Questions — Docs i18n Bolt 4

> incident-response / 2026-08-06 · Answers: **recommended**  
> Intent: `260802-docs-bridge` · local-only · Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)

## Q1. Scope of incidents

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Bridge degrade regressions (excerpt remount, CTA/label, open-official-doc emit, external browser) — not cloud SEV-1 |
| B | Full multi-service on-call plan |

**Answer:** A

## Q2. Escalation

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Intent owner / PR author; no 24×7 pager |
| B | Formal PagerDuty rotation |

**Answer:** A

## Q3. Runbooks

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Short symptom→fix cards + point at [rollback-runbook](../deployment-pipeline/rollback-runbook.md) |
| B | Enterprise ITIL / AWS Incident Manager pack |

**Answer:** A

## Completeness

**Answer:** Looks correct and generate
