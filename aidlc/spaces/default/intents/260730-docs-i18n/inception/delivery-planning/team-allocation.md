# Team Allocation — Docs i18n

> ステージ: delivery-planning / 2026-07-31  
> 上流: bolt-plan.md · unit-of-work.md · team-practices.md · stories.md · requirements.md · mockups.md · components.md · unit-of-work-dependency.md · unit-of-work-story-map.md  
> team-formation (1.5): **SKIP** — 全 Bolt は AI 実行（aidlc-developer-agent 既定）+ 人間ゲート

## Assignment

| Bolt | Units | Executor | Human role |
|------|-------|----------|------------|
| B1 walking skeleton | content-snapshot, official-docs, docs-api, docs-shell (thin) | aidlc-developer-agent (+ design for Shell) | Approve skeleton gate |
| B2 locale | docs-shell, official-docs polish | aidlc-developer-agent | Stage gates as configured |
| B3 deep link | docs-navigation | aidlc-developer-agent | Approve AC demo |
| B4 Bridge | docs-navigation | aidlc-developer-agent | Approve degrade |
| B5 diff (Should) | diff-report | aidlc-developer-agent | Optional cut / approve |

## Notes

- No multi-mob Program Board (single feature scope, 1.5 skipped).  
- Content/translation PR review remains human (US-07 constraint) even when AI drafts ja bootstrap in B1.  
- Architect support on B1 for layer seams / import bans.
