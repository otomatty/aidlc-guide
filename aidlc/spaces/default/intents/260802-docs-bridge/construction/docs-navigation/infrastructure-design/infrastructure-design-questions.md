# Infrastructure Design Questions — Unit: docs-navigation (Bolt 4)

> infrastructure-design / docs-navigation (ui) / 2026-08-04  
> Intent: `260802-docs-bridge`  
> **Answered:** Yes — recommended defaults (user: 作業を続けてください)

---

## Q1. Deployable surface

- A. No new deployable — StageCard / host / Shell inside existing vscode-extension + dashboard Webview（Recommended — NFR-B4-3）
- B. Separate static hosting
- X. その他

[Answer]: A

## Q2. CI gates

- A. Existing `bun run check` + non-mount / CTA contract tests; no new GitHub Actions workflow（Recommended — NFR-B4-2）
- B. New dedicated Bridge E2E CI gate as Must
- X. その他

[Answer]: A

## Q3. Shared infra

- A. Reuse open-official-doc host + Shell + api-core stage map; UI-only excerpt omit（Recommended）
- B. New BFF / cloud service
- X. その他

[Answer]: A

## Q4. Monitoring / cloud

- A. No cloud monitoring; omit infrastructure-services（Recommended）
- B. CloudWatch / RUM
- X. その他

[Answer]: A

## Consolidated Summary Confirmation

[Answer]: A
