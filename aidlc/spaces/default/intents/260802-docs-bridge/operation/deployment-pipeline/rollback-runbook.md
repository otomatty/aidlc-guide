# Rollback Runbook — Docs i18n Bolt 4

> deployment-pipeline / 2026-08-05  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [cicd-pipeline.md](../../construction/docs-navigation/infrastructure-design/cicd-pipeline.md)  
> Q3 = A

## When to rollback

Bridge / StageCard excerpt reappears, Open in Docs CTA regresses, or `open-official-doc` / Docs Shell land breaks after a release build or merge.

## Procedure

1. **Code:** `git revert` the offending commit(s) on `main` (or restore previous tag) and open PR — GHA should pass.  
2. **Extension:** Rebuild prior known-good VSIX (`bun run build:extension` from good SHA) and reinstall in the editor.  
3. **Verify:** No `docs-excerpt` accordion; **Open in Docs** → Docs Shell; no external browser.  
4. **Escalate:** No cloud state to restore.

## Contacts / escalation

Owner: intent driver (local project). No on-call cloud rotation.

## Review

**Verdict:** READY
