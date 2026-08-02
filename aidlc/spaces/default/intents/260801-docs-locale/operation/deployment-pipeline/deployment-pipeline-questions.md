# Deployment Pipeline Questions — Docs i18n Bolt 2

> deployment-pipeline / 2026-08-02 · Answers: **recommended** (local-only)

## Q1. Deployment strategy

| Option | Description |
|--------|-------------|
| **A (Recommended)** | No cloud CD — release by merge to `main` + local/extension VSIX package |
| B | Blue/green cloud deploy |
| C | Marketplace auto-publish from CI |

**Answer:** A

## Q2. Environment promotion

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Dev = local workspace; “prod” = published extension build — no staging cloud |
| B | dev → staging → prod AWS |

**Answer:** A

## Q3. Production approval

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Human PR review + `bun run check` / GHA green before merge |
| B | Automated prod push without review |

**Answer:** A

## Q4. Rollback

| Option | Description |
|--------|-------------|
| **A (Recommended)** | `git revert` / re-install previous VSIX; no traffic shift |
| B | Cloud rollback runbook with ASG |

**Answer:** A

## Completeness

**Answer:** Looks correct and generate
