# Frontend Components — Unit: docs-navigation (Bolt 4)

> functional-design / docs-navigation (ui) / 2026-08-04  
> Intent: `260802-docs-bridge`  
> 上流: [business-logic-model.md](./business-logic-model.md) · [mockups](../../../inception/refined-mockups/mockups.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [components.md](../../../inception/application-design/components.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [services.md](../../../inception/application-design/services.md)  
> Q1–Q6 = 1 · 親 Bolt 3 FC は差分適用のみ

## Component map (delta)

| Component | Package | Bolt 4 change |
|-----------|---------|-----------------|
| **StageCard** | dashboard | **Remove** `docs-excerpt` Accordion branch even when `doc.excerpt != null` (F4-1) |
| **OpenOfficialDocLink** | dashboard | Label/aria → **`Open in Docs`**; Button **`variant="default"`** (primary); keep `data-testid="open-official-doc"`; emit path unchanged |
| Legacy Bridge docs UI | dashboard | Same CTA + non-mount rules; prefer reuse OpenOfficialDocLink（Q4=1） |
| Host `open-official-doc.ts` | vscode-extension | **Reuse** — regression only |
| DocsShell / AnchorApplier | dashboard | Unchanged（Bolt 3 land） |

## Props / a11y pins

| Control | Visible | `aria-label` | Variant | testid |
|---------|---------|--------------|---------|--------|
| Primary CTA | `Open in Docs` | `Open in Docs` | `default` (solid) | `open-official-doc` |

- Tab order: Open in Docs is the first docs action in the StageCard / Bridge docs region.  
- Keyboard: Tab → Enter/Space activates（US-B4-02）.  
- Extension Webview only（NFR-B4-3）.

## State

No new store fields. Reuse Bolt 3:

| Field | Notes |
|-------|--------|
| `officialDocsLocale` | locale for payload build |
| `docsShellDeepLink` | host inject → Shell one-shot（unchanged） |

`doc.excerpt` may still arrive on stage payload; **UI ignores it**（do not require nulling at fetch boundary — Q2=1）.

## Interaction

| Event | Behavior |
|-------|----------|
| StageCard / Bridge render | No excerpt article region |
| CTA activate | F4-2（BLM）→ open-official-doc |
| Optional glossary/aids | Allowed if present; must not restore excerpt article（Q5=1） |

## Verification hooks（Demo-first — Q6=1）

| Check | Assertion |
|-------|-----------|
| Non-mount | `screen.queryByTestId("docs-excerpt")` null even with fixture excerpt |
| CTA contract | click/keyboard → posted message `type: "open-official-doc"` |
| Primary | CTA is solid primary; not ghost while another docs control dominates |
| Host | reuse spy / existing host tests; no new message type |
| Demo | Bridge → Open in Docs → Shell; no external browser |

## Forbidden

- Mounting excerpt Accordion / article body on Extension StageCard / Bridge  
- New host message type or parallel land path  
- `import` of `@aidlc-guide/official-docs` in dashboard  
- IDE primary path calling `docsOpenHref` / `open-doc` / `openExternal`  
- Making US-B4-S1 absence fail Must DoD  

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-04  
**Verdict:** READY  
**Note:** Inline §12a; aligns with BLM F4-1…4 and ADR-B4-001/002.
