# Environment Provisioning Questions — Docs i18n Bolt 4

> environment-provisioning / 2026-08-05  
> Intent: `260802-docs-bridge` · local-only（NFR-B4-3）  
> **Answered:** Yes — recommended defaults

---

## Q1. Cloud environments

- A. None — skip AWS VPC/secrets provisioning（Recommended）
- B. Provision new AWS accounts / VPCs
- X. その他

[Answer]: A

## Q2. What to inventory

- A. Local developer + CI runners + extension host only（Recommended）
- B. Multi-account AWS inventory
- X. その他

[Answer]: A

## Q3. Validation

- A. Validate bun toolchain + Bolt 4 focused vitest / tsc；no cloud health checks（Recommended）
- B. CloudFormation drift / Config rules
- X. その他

[Answer]: A

## Consolidated Summary Confirmation

[Answer]: A
