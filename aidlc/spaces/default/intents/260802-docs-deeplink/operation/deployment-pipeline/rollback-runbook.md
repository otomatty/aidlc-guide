# Rollback Runbook — Docs i18n Bolt 3

> deployment-pipeline / 2026-08-02  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [cicd-pipeline.md](../../construction/docs-navigation/infrastructure-design/cicd-pipeline.md)  
> Q3 = A

## When to rollback

StageCard deep-link / openOfficialDoc / Docs Shell land regressions after a release build or merge.

## Procedure

1. **Code:** `git revert` the offending commit(s) on `main` (or restore previous tag) and open PR — GHA should pass.  
2. **Extension:** Rebuild prior known-good VSIX (`bun run build:extension` from good SHA) and reinstall in the editor.  
3. **Verify:** StageCard docs link → Docs Shell opens mapped path; unmapped → Shell top; no external browser on mapped path.  
4. **Escalate:** No cloud state to restore; host `globalState` locale key `aidlcGuide.officialDocsLocale` can be cleared via extension reset if needed.

## Contacts / escalation

Owner: intent driver (local project). No on-call cloud rotation.

## Review

**Verdict:** READY
