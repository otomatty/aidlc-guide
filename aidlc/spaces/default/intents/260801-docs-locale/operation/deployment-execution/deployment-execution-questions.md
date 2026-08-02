# Deployment Execution Questions — Docs i18n Bolt 2

> deployment-execution / 2026-08-02 · Answers: **recommended**

## Q1. What to “deploy”

| Option | Description |
|--------|-------------|
| **A (Recommended)** | No cloud deploy — treat merge-ready workspace + automated smoke as execution; VSIX install is optional human step |
| B | Run full marketplace publish |

**Answer:** A

## Q2. Smoke scope

| Option | Description |
|--------|-------------|
| **A (Recommended)** | official-docs + api-core routes + docs-shell vitest (Bolt 2 AC) |
| B | Full `bun run check` including flaky timings |

**Answer:** A

## Q3. Extension manual (FR-B2-5.2)

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Leave as human checklist (artifact already written); do not block gate |
| B | Block until screenshots attached |

**Answer:** A

## Completeness

**Answer:** Looks correct and generate
