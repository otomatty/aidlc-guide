# Code Generation Plan — Unit: docs-navigation (Bolt 4)

> Intent: `260802-docs-bridge` · 2026-08-05  
> Design: FD Q1–Q6=1 · Demo-first · host reuse  
> Workspace: packages/dashboard (+ host regression only if needed)

## Story → steps

| Story | Steps |
|-------|-------|
| US-B4-01 | Remove StageCard `docs-excerpt` mount; test non-mount with fixture excerpt |
| US-B4-02 | Pin CTA `Open in Docs` + solid Button; keep `open-official-doc` emit |
| US-B4-03 | Update/extend `bun run check` tests; Demo note in summary |
| US-B4-S1 | No change required (optional aids; cuttable) |

## Checklist

### Demo-first tests

- [x] Flip StageCard excerpt test → assert `docs-excerpt` **absent** when excerpt present
- [x] Update OpenOfficialDocLink a11y test → name/label `Open in Docs`
- [x] Keep mapped emit / no open-doc / no external browser coverage (existing)

### Production UI

- [x] `OpenOfficialDocLink`: label + aria = `Open in Docs`; `variant="default"`
- [x] `StageCard`: omit excerpt Accordion entirely (UI-only; API may still return excerpt)
- [x] Remove unused Accordion imports from StageCard

### Host / packages

- [x] vscode-extension `open-official-doc.ts` — **no change** (reuse)
- [x] No new packages / message types

### Docs / plan closeout

- [x] code-summary.md after verify
