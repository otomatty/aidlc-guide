# Rollback Runbook — Docs i18n Bolt 2

> deployment-pipeline / 2026-08-02  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [docs-shell deployment-architecture](../../construction/docs-shell/infrastructure-design/deployment-architecture.md) · [docs-shell cicd-pipeline](../../construction/docs-shell/infrastructure-design/cicd-pipeline.md)

## When to rollback

Docs Shell locale / notice / resolve regressions after a release build or merge.

## Procedure

1. **Code:** `git revert` the offending commit(s) on `main` (or restore previous tag) and open PR — GHA must pass.  
2. **Extension:** Rebuild prior known-good VSIX (`bun run build:extension` from good SHA) and reinstall in the editor.  
3. **Verify:** Docs Shell opens; en↔ja keep-path; `missing_ja` notice with `role=status`; no notice on 404.  
4. **Escalate:** If content trees are corrupt, restore `docs/guide|reference` from git; no cloud state to restore.

## Contacts / escalation

Owner: intent driver (local project). No on-call cloud rotation.

## Review

**Verdict:** READY
