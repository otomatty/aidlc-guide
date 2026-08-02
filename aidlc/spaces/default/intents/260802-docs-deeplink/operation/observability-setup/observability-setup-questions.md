# Observability Setup Questions — Docs i18n Bolt 3

> observability-setup / 2026-08-02  
> Intent: `260802-docs-deeplink` · local-only  
> **Recommended** は各問に記す。

---

## Q1. Cloud observability

- A. None — no CloudWatch / X-Ray / RUM（Recommended）
- B. Provision full AWS observability stack
- X. その他（具体的に記入）

[Answer]: A

## Q2. What counts as signals

- A. CI / focused Bolt 3 vitest / Extension manual demo（Recommended）
- B. Production SLOs with 99.9% targets
- X. その他（具体的に記入）

[Answer]: A

## Q3. Alarms

- A. PR/CI failure is the alarm；no paging stack（Recommended）
- B. PagerDuty on deep-link errors
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — generate（Recommended）
- B. Needs revision — (specify)

[Answer]: A
