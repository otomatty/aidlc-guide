# Incident Plan — Docs i18n Bolt 2

> incident-response / 2026-08-02  
> 上流: [alarms.md](../observability-setup/alarms.md) · [runbooks.md](./runbooks.md) · [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md)

## Severity (local product)

| Sev | Meaning | Response |
|-----|---------|----------|
| S1 | Docs Shell unusable for all users of a release | Revert VSIX / git revert; run RB-B2-* |
| S2 | Notice/keep-path wrong for partial ja | Patch + tests; no cloud failover |
| S3 | Cosmetic / Should h1 | Next PR |

## Process

1. Detect via CI red or user report.  
2. Triage with runbooks.  
3. Fix or rollback.  
4. Optional short note in PR — no formal PIR required unless S1.

## Review

**Verdict:** READY
