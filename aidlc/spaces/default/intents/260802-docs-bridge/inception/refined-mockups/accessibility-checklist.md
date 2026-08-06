# Accessibility Checklist — Docs i18n Bolt 4

> Intent: `260802-docs-bridge` · Target: WCAG 2.2 AA scoped (Q6 = A) · 2026-08-03  
> 上流: [mockups.md](./mockups.md) · [interaction-spec.md](./interaction-spec.md) · [requirements.md](../requirements-analysis/requirements.md)

## Scope

Extension Webview Bridge / StageCard docs UI + activation into existing Docs Shell. Shell internals unchanged (Q7 = A).

## Checklist

| ID | Criterion | Mid-fi / story | Status |
|----|-----------|----------------|--------|
| A11y-1 | Open in Docs has clear accessible name (not color-only) | RM-B4-2 / Q2=C | Design OK — FD final string |
| A11y-2 | Keyboard: Tab to CTA, Enter/Space activates | IX-B4-1 / US-B4-02 | Design OK |
| A11y-3 | Focus visible on CTA | existing DS focus ring | Design OK |
| A11y-4 | Excerpt not exposed as document body | RM-B4-1 / US-B4-01 | Design OK |
| A11y-5 | Land focus follows Bolt 3 Shell rules | Q7=A | Inherited |
| A11y-6 | Error path does not trap focus | IX-B4-3 | Design OK (reuse patterns) |
| A11y-7 | Optional aids not required for task completion | Q8=A / US-B4-S1 | Design OK |

## Out of a11y Must for this Bolt

- Full Docs Shell redesign audit (already covered by prior Bolts)
- AAA contrast upgrades beyond existing DS
