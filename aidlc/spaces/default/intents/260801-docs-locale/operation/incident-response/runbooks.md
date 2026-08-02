# Runbooks — Docs i18n Bolt 2

> incident-response / 2026-08-02  
> 上流: [alarms.md](../observability-setup/alarms.md) · [dashboards.md](../observability-setup/dashboards.md) · [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md) · [docs-shell security-design](../../construction/docs-shell/nfr-design/security-design.md)

## RB-B2-1 — Untranslated notice missing or wrong

1. Confirm wire: page has `notice==="missing_ja"` (api-core 200, not 404).  
2. Check DocsShell gates notice off on `pageView` error.  
3. Re-run `docs-shell.test.tsx`.  
4. If content issue: add ja file or accept en fallback.

## RB-B2-2 — Locale switch jumps path

1. Verify `selectedPath` not rewritten on TOC miss (keep-path).  
2. Re-run keep-path / sparse-ja tests.  
3. Revert recent DocsShell effect changes if regressed.

## RB-B2-3 — Coverage floor fails in CI

1. Inspect `coverage/coverage-summary.json` for resolve/roots/markdown.  
2. Add branch tests or fix instrumentation (`allowExternal` on Windows).  
3. Do not lower thresholds.

## RB-B2-4 — Rollback release

Follow [rollback-runbook.md](../deployment-pipeline/rollback-runbook.md).

## Review

**Verdict:** READY
