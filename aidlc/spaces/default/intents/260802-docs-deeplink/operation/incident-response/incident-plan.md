# Incident Plan — Docs i18n Bolt 3

> incident-response / 2026-08-02  
> 上流: [alarms.md](../observability-setup/alarms.md) · [runbooks.md](./runbooks.md) · [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md) · [reliability-design](../../construction/docs-navigation/nfr-design/reliability-design.md)  
> Q1 = A · Q2 = A

## Severity (local product)

| Sev | Meaning | Response |
|-----|---------|----------|
| S1 | StageCard docs path unusable for all users of a release (always external / never Shell) | Revert VSIX / git revert; run RB-B3-1 / RB-B3-6 |
| S2 | Partial wrong land (unmapped, locale, invalid ignore) | Patch + focused vitest; no cloud failover |
| S3 | Cosmetic / a11y label / deferred demo-record | Next PR |

## Process

1. Detect via CI red, focused Bolt 3 vitest fail, or user report.  
2. Triage with RB-B3-* runbooks.  
3. Fix or rollback.  
4. Optional short note in PR — no formal PIR unless S1.

## Cloud / AWS Incident Manager

**N/A** — local extension feature; no SSM Automation library.

## Review

**Verdict:** READY
