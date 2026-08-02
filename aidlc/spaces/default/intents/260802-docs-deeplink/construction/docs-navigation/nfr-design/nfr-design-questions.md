# NFR Design Questions — Unit: docs-navigation (Bolt 3)

> nfr-design / docs-navigation (ui) / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 上流: nfr-requirements (Q1–Q5 = A) · [business-logic-model.md](../functional-design/business-logic-model.md)  
> produces (ui): performance-design / security-design / logical-components（scalability・reliability design は service 向け → omit / N/A stub）  
> **Recommended** は各問に記す。

---

## Q1. Performance mechanisms

How do we realize P-B3-DN-1…4 (local-only, no ms floor, check+demo, no new coverage floor)?

- A. Design = reuse existing StageCard → host → Shell inject; no new heavy deps; no latency instrumentation Must（Recommended）
- B. Add Shell-open timing harness as Must
- X. その他（具体的に記入）

[Answer]: A

## Q2. Host validation placement

Where is S-B3-DN-1 payload validation designed?

- A. Extension host only (webview untrusted); reject invalid locale / empty mapped path before persist+inject（Recommended — ADR-B3-001）
- B. Validate only in Webview before postMessage
- X. その他（具体的に記入）

[Answer]: A

## Q3. Legacy path separation

How is S-B3-DN-3 (no open-doc on mapped StageCard) designed?

- A. Mapped StageCard path emits `open-official-doc` only; forbid `docsOpenHref` / `open-doc` / `openExternal` on that path; legacy open-doc remains for non-official surfaces（Recommended）
- B. Reuse open-doc with a flag
- X. その他（具体的に記入）

[Answer]: A

## Q4. Logical component boundaries

- A. Logical components = OpenOfficialDocLink / StageCard wire / host openOfficialDoc handler / DocsShell deep-link apply; map stays in official-docs + api-core（Recommended — ADR-B3-002）
- B. Move STAGE_DOC_MAP into dashboard
- X. その他（具体的に記入）

[Answer]: A

## Q5. Scalability / reliability design

- A. Omit full scalability-design / reliability-design for ui; N/A stubs only（Recommended — matches Bolt 2 + Q5 NFR req）
- B. Write service SLO designs
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — generate（Recommended）
- B. Needs revision — (specify)

[Answer]: A
