# Frontend Components — Unit: docs-navigation (Bolt 3)

> functional-design / docs-navigation (ui) / 2026-08-02  
> 上流: [business-logic-model.md](./business-logic-model.md) · [mockups](../../../inception/refined-mockups/mockups.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [components.md](../../../inception/application-design/components.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [services.md](../../../inception/application-design/services.md)  
> Q5 = A

## Component map

| Component | Package | Role |
|-----------|---------|------|
| OpenOfficialDocLink | dashboard | StageCard control; accessible name `Docs: <stageDisplayName>`; builds payload; posts `open-official-doc` |
| StageCard | dashboard | Hosts link; removes mapped-path use of `docsOpenHref` / IDE open |
| DocsShell | dashboard | Consumes `docsShellDeepLink` including `locale`; one-shot clear |
| AnchorApplier | dashboard | Reuse Bolt 2 — scrolled / top / none |
| LocaleControl | dashboard | Set from deep-link locale on land（not focus target after land） |
| Host `handleOpenOfficialDoc` | vscode-extension | Validate, persist preference, open Shell, inject deep-link |
| Payload types | shared-types | Mapped / unmapped discriminant |

## State

| Store field | Shape |
|-------------|--------|
| `docsShellDeepLink` | `{ locale: "en"\|"ja"; path?: string; anchor?: string } \| null` — when non-null, `locale` is required |
| host globalState | last official-docs locale `"en"\|"ja"` |

## Interaction

| Event | Behavior |
|-------|----------|
| Link activate | F1 or F2（BLM） |
| Shell land | apply locale/path/anchor; clear deep-link; focus rule |
| Activating UI | retain idle link appearance; no spinner（refined mockups） |

## A11y

- Tab + Enter/Space on OpenOfficialDocLink  
- Accessible name ≠ bare `Docs`  
- Focus after land: heading or h1/main  
- Extension Webview only（NFR-B3-2）

## Forbidden

- `import` of `@aidlc-guide/official-docs` in dashboard  
- Mapped activate → `open-doc` / `docsOpenHref`
