# Incident Response Questions — Docs i18n Bolt 3

> incident-response / 2026-08-02 · Answers: **recommended**  
> Intent: `260802-docs-deeplink` · local-only · Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29)

## Q1. Scope of incidents

| Option | Description |
|--------|-------------|
| **A (Recommended)** | StageCard → openOfficialDoc → Docs Shell regressions (wrong land, external browser, invalid persist, locale miss) — not cloud SEV-1 |
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
