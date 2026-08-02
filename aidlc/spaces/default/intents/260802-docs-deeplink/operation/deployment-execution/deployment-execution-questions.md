# Deployment Execution Questions — Docs i18n Bolt 3

> deployment-execution / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> **Recommended** は各問に記す。

---

## Q1. What to “deploy”

- A. No cloud deploy — merge-ready workspace + automated smoke；VSIX install is optional human step（Recommended）
- B. Run full marketplace publish
- X. その他（具体的に記入）

[Answer]: A

## Q2. Smoke scope

- A. Bolt 3 focused vitest (45) + tsc（Recommended）
- B. Full `bun run check` including flaky timings
- X. その他（具体的に記入）

[Answer]: A

## Q3. Extension manual (FR-B3-6.2)

- A. Leave as human checklist ([demo-record.md](../../construction/docs-navigation/code-generation/demo-record.md))；do not block gate（Recommended）
- B. Block until screenshots attached
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — generate（Recommended）
- B. Needs revision — (specify)

[Answer]: A
