# Component Methods — Docs i18n Bolt 4

> Intent: `260802-docs-bridge` · application-design · 2026-08-03  
> 上流: [components.md](./components.md) · [requirements.md](../requirements-analysis/requirements.md)

## dashboard

| Method / surface | Responsibility | Notes |
|------------------|----------------|-------|
| StageCard / Bridge render | Omit excerpt Accordion when degrading | FR-B4-1; test id `docs-excerpt` absent |
| Open in Docs CTA | Primary Button; activate → emit | FR-B4-2; reuse `OpenOfficialDocLink` pattern |
| `postMessage({ type: "open-official-doc", ... })` | Emit host contract | Payload per FR-B3-1.1 |

## vscode-extension

| Method / surface | Responsibility | Notes |
|------------------|----------------|-------|
| `handleOpenOfficialDoc` / `open-official-doc.ts` | Validate + inject Shell deep-link | **Reuse** Bolt 3; no new message type (Q2=A) |

## Not in scope (methods)

| Surface | Why |
|---------|-----|
| docs-bridge excerpt removal API | Q3=A — UI-only Must |
| New HTTP routes | Q2 ≠ C |
