# Deployment Execution Questions — Docs i18n Bolt 4

> deployment-execution / 2026-08-06  
> Intent: `260802-docs-bridge`  
> **Answered:** Yes — recommended defaults

---

## Q1. What to “deploy”

- A. No cloud deploy — merge-ready workspace + automated smoke；VSIX install is optional human step（Recommended）
- B. Run full marketplace publish
- X. その他

[Answer]: A

## Q2. Smoke scope

- A. Bolt 4 focused vitest (51) + tsc（Recommended）
- B. Full `bun run check` including flaky timings
- X. その他

[Answer]: A

## Q3. Extension manual (FR-B4-3.1)

- A. Leave as human checklist ([demo-record.md](../../construction/docs-navigation/code-generation/demo-record.md))；do not block gate（Recommended）
- B. Block until screenshots attached
- X. その他

[Answer]: A

## Consolidated Summary Confirmation

[Answer]: A
