# Deployment Pipeline Questions — Docs i18n Bolt 4

> deployment-pipeline (Operation) / 2026-08-05  
> Intent: `260802-docs-bridge`  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md)  
> Local-only extension（NFR-B4-3）— recommended defaults applied

---

## Q1. Deployment strategy

- A. No cloud CD — merge to main + local extension/VSIX package / reload（Recommended）
- B. Blue/green or canary to a hosted service
- X. その他

[Answer]: A

## Q2. CD tool

- A. None — document manual/local package steps only（Recommended）
- B. Add marketplace publish from Actions
- X. その他

[Answer]: A

## Q3. Rollback

- A. Git revert / reinstall previous VSIX；no infra rollback beyond that（Recommended）
- B. Automated multi-env rollback pipeline
- X. その他

[Answer]: A

## Consolidated Summary Confirmation

[Answer]: A
