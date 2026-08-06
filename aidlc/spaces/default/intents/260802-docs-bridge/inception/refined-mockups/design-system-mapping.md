# Design System Mapping — Docs i18n Bolt 4

> Intent: `260802-docs-bridge` · Q5 = A · 2026-08-03  
> 上流: [mockups.md](./mockups.md) · [wireframes.md](../../ideation/rough-mockups/wireframes.md) · codekb `component-inventory`

## Principle

**Extend existing dashboard components.** No new design language.

## Component Map

| Mid-fi element | Existing component / pattern | Package |
|----------------|------------------------------|---------|
| Open in Docs primary | Button (primary variant) | `dashboard` |
| Guidance text | existing muted / helper text styles | `dashboard` |
| Optional glossary aids | existing chips / secondary links if any | `dashboard` |
| Docs Shell (land) | existing Docs Shell (Bolt 1–3) | `dashboard` |
| Host open | `open-official-doc` + `OpenOfficialDocLink` patterns | `vscode-extension` / `dashboard` |

## Tokens

Reuse current spacing, type scale, focus rings, and primary button colors. Do not introduce new brand colors for Bridge.

## Anti-patterns

| Avoid | Why |
|-------|-----|
| New hero CTA styling | Q3 = A / Q5 = A |
| Excerpt Accordion as article | FR-B4-1 / US-B4-01 |
| Bare icon-only Open in Docs | Q6 = A (name must be clear) |
