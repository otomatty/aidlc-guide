# Environment Provisioning Questions — Docs i18n Bolt 3

> environment-provisioning / 2026-08-02  
> Intent: `260802-docs-deeplink` · local-only（NFR-B3-2）  
> **Recommended** は各問に記す。

---

## Q1. Cloud environments

- A. None — skip AWS VPC/secrets provisioning（Recommended）
- B. Provision new AWS accounts / VPCs
- X. その他（具体的に記入）

[Answer]: A

## Q2. What to inventory

- A. Local developer + CI runners + extension host only（Recommended）
- B. Multi-account AWS inventory
- X. その他（具体的に記入）

[Answer]: A

## Q3. Validation

- A. Validate bun toolchain + Bolt 3 focused vitest / tsc；no cloud health checks（Recommended）
- B. CloudFormation drift / Config rules
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — generate（Recommended）
- B. Needs revision — (specify)

[Answer]: A
