# Infrastructure Design Questions — Unit: docs-navigation (Bolt 3)

> infrastructure-design / docs-navigation (ui) / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 上流: nfr-design READY · local-only extension (NFR-B3-1/2)  
> produces (ui): deployment-architecture / cicd-pipeline + optional shared-infrastructure  
> **Recommended** は各問に記す。

---

## Q1. Deployable surface

- A. No new deployable — StageCard / host / Shell ship inside existing vscode-extension + dashboard Webview（Recommended — NFR-B3-2）
- B. Separate static hosting for deep-link landing
- X. その他（具体的に記入）

[Answer]: A

## Q2. CI gates

- A. Existing `bun run check` + C1–C7 / boundary tests; no new GitHub Actions workflow（Recommended）
- B. New dedicated deep-link E2E CI gate as Must
- X. その他（具体的に記入）

[Answer]: A

## Q3. Shared infra

- A. Reuse api-core stage route + shared-types + existing host/Shell; document forbidden dashboard→official-docs import only（Recommended — ADR-B3-002）
- B. New BFF / cloud map service
- X. その他（具体的に記入）

[Answer]: A

## Q4. Monitoring / cloud services

- A. No cloud monitoring / infrastructure-services design; omit (ui produces_kinds + local-only)（Recommended）
- B. CloudWatch / RUM for deep-link
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — generate（Recommended）
- B. Needs revision — (specify)

[Answer]: A
