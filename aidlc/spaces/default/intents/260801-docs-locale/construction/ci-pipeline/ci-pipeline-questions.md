# CI Pipeline Questions — Docs i18n Bolt 2

> ci-pipeline / 2026-08-02 · Answers: **recommended**

## Q1. CI tool

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Keep existing GitHub Actions `.github/workflows/check.yml` (mirrors `bun run check`) |
| B | Add CodeBuild / CodePipeline |
| C | Replace with another CI |

**Answer:** A

## Q2. Branch strategy

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Trunk/`main` + PR to main (existing) |
| B | Long-lived release branches |

**Answer:** A

## Q3. Quality gates for Bolt 2

| Option | Description |
|--------|-------------|
| **A (Recommended)** | No new workflow — rely on `bun run check` + existing matrix; document NFR-B2-1 floors already in vitest thresholds |
| B | Add a separate docs-only workflow |
| C | Skip CI documentation |

**Answer:** A

## Q4. Artifacts / deploy

| Option | Description |
|--------|-------------|
| **A (Recommended)** | No cloud artifact repo; release = merge + extension/VSIX package locally |
| B | Push VSIX to marketplace from CI |

**Answer:** A

## Completeness

**Answer:** Looks correct and generate
