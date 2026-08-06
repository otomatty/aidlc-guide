# NFR Design Questions — Unit: docs-navigation (Bolt 4)

> nfr-design / docs-navigation (ui) / 2026-08-04  
> Intent: `260802-docs-bridge`  
> 上流: nfr-requirements (Q1–Q5 = A) · [business-logic-model.md](../functional-design/business-logic-model.md)  
> produces (ui): performance-design / security-design / logical-components  
> **Answered:** Yes — recommended defaults (user: 作業を続けてください)

---

## Q1. Performance mechanisms

- A. Reuse StageCard / OpenOfficialDocLink → host → Shell; UI omit excerpt; no latency instrumentation Must（Recommended）
- B. Add Shell-open timing harness as Must
- X. その他

[Answer]: A

## Q2. Host validation placement

- A. Extension host only (Bolt 3 reuse); Webview untrusted（Recommended）
- B. Validate only in Webview
- X. その他

[Answer]: A

## Q3. Excerpt + primary CTA security design

- A. UI-only omit `docs-excerpt`; primary CTA emits `open-official-doc` only; no openExternal / legacy open-doc on IDE path（Recommended — ADR-B4-001/002）
- B. Delete excerpt from API as Must + new message type
- X. その他

[Answer]: A

## Q4. Logical component boundaries

- A. StageCard (no excerpt) + OpenOfficialDocLink (`Open in Docs`, solid) + host reuse + DocsShell land; map stays outside dashboard（Recommended）
- B. Move STAGE_DOC_MAP into dashboard
- X. その他

[Answer]: A

## Q5. Scalability / reliability design

- A. N/A stubs only for ui（Recommended）
- B. Write service SLO designs
- X. その他

[Answer]: A

## Consolidated Summary Confirmation

[Answer]: A
