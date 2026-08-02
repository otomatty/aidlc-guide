# Deployment Pipeline Questions — Docs i18n Bolt 3

> deployment-pipeline (Operation) / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md)  
> Local-only extension（NFR-B3-2）— **Recommended** は各問に記す。

---

## Q1. Deployment strategy

- A. No cloud CD — merge to main + local extension/VSIX package / reload（Recommended）
- B. Blue/green or canary to a hosted service
- X. その他（具体的に記入）

[Answer]: A

## Q2. CD tool

- A. None — document manual/local package steps only（Recommended）
- B. Add marketplace publish from Actions
- X. その他（具体的に記入）

[Answer]: A

## Q3. Rollback

- A. Git revert / reinstall previous VSIX；no infra rollback runbook beyond that（Recommended）
- B. Automated multi-env rollback pipeline
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — generate（Recommended）
- B. Needs revision — (specify)

[Answer]: A
