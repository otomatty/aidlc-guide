# Environment Provisioning Questions — Docs i18n Bolt 2

> environment-provisioning / 2026-08-02 · Answers: **recommended**

## Q1. Cloud environments

| Option | Description |
|--------|-------------|
| **A (Recommended)** | None — project local-only; skip AWS VPC/secrets provisioning |
| B | Provision new AWS accounts / VPCs |

**Answer:** A

## Q2. What to inventory

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Local developer + CI runners + extension host as the only “environments” |
| B | Multi-account AWS inventory |

**Answer:** A

## Q3. Validation

| Option | Description |
|--------|-------------|
| **A (Recommended)** | Validate bun/node toolchain + `bun run check` Bolt 2 suites; no cloud health checks |
| B | CloudFormation drift / Config rules |

**Answer:** A

## Completeness

**Answer:** Looks correct and generate
