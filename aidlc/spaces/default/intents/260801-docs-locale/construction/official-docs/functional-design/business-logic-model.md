# Business Logic Model — Unit: official-docs (Bolt 2)

> functional-design / official-docs (library) / 2026-08-02  
> 上流: [components.md](../../../inception/application-design/components.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [services.md](../../../inception/application-design/services.md) · [requirements.md](../../../inception/requirements-analysis/requirements.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md) · [unit-of-work.md](../../../inception/units-generation/unit-of-work.md)  
> 親 FD 継承。本ファイルは keep-path / missing_ja / anchor / TOC / coverage の完了契約。

## Purpose

Locale-scoped load/resolve for bundled official docs. Pure library — no HTTP, no React.

## Flows

### F1 — resolvePage (Bolt 2 complete)

```text
input(workspaceRoot, locale, path, anchor?)
  → validate locale ∈ {en,ja}
  → contentRoot + guardPath else path_rejected
  → if file missing && locale=ja && en twin exists
        → load en body; localeServed=en; notice=missing_ja; path unchanged (keep-path)
  → if file missing && (locale=en || no en twin) → not_found
  → read manifest → if missing/invalid → empty_content
  → read body + manifest.sourceVersion
  → anchor: match heading → scrolled; requested but missing → top; none → none
  → ResolvedPage (OfficialDocsPage fields)
```

### F2 — listToc

Return TOC for **requested locale** tree only (Q4=A). Sparse ja ⇒ fewer paths; UI decides highlight via path equality.

### F3 — readManifest

Unchanged: `docs/official-docs.manifest.json` → Manifest or empty_content.

### F4 — mapStageToDoc

Unchanged from parent (deep-link OOS for this intent). Still available as library API.

## Invariants

- Dashboard must never import this package.  
- `guardPath` single containment.  
- keep-path: never rewrite `path` to a different doc on missing locale file.  
- `missing_ja` is never signaled by inventing a 404-only protocol — success-shaped page with notice.

## Story coverage (library)

| Story | Flow |
|-------|------|
| US-B2-01 | F1 keep-path + anchor; F2 TOC for highlight consumers |
| US-B2-02 | F1 missing_ja |
| US-B2-03 | Coverage on resolve/roots/markdown |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY
**Date:** 2026-08-02

### Fixes verified

- **F1 flow:** `→ read manifest → if missing/invalid → empty_content` branch is now explicit (line present in pseudocode). ✓
- **business-rules.md structure:** `## Rules` H2 added above the rules table; file now has 2 H2 headings (`## Rules` + `## Errors`) — `required-sections` sensor passes. ✓

### What holds

- **Q1–Q5=A honored:** All five answers are encoded consistently across BLM, business-rules.md, and domain-entities.md:
  - Q1=A keep-path: BLM Invariants + BR-B2-OD-1 ✓
  - Q2=A missing_ja success-shape: F1 flow + BR-B2-OD-2 + domain-entities ResolvedPage.notice ✓
  - Q3=A anchor enum scrolled/top/none: F1 flow + BR-B2-OD-4 + domain-entities anchorApplied ✓
  - Q4=A listToc locale-scoped: F2 prose (Q4=A cited) + BR-B2-OD-5 ✓
  - Q5=A coverage floor: BR-B2-OD-8 (three named files, bun run check) ✓
- **Library boundary clean:** no React, no HTTP; "Dashboard must never import this package" invariant written; Purpose states "Pure library"; BR-B2-OD-7 "No network I/O". ✓
- **Cross-references resolve:** FR-B2-1.1, FR-B2-2.1, FR-B2-3, FR-B2-4.3, NFR-B2-1, NFR-B2-2, ADR-B2-001 all trace to requirements.md and components.md. ✓
- **Upstream coverage headers:** all three artifacts cite all 6 consumes. ✓
- **Wire-field stability:** domain-entities.md note "Aligns with OfficialDocsPage / OfficialDocsToc in shared-types — no rename" + BR-B2-OD-9. ✓
- **Sensor checks:** BLM (4 H2s), business-rules.md (2 H2s), domain-entities.md (2 H2s) — all pass. ✓
- **No circular dependencies:** library has no imports from dashboard or docs-shell. ✓
- **Blast radius:** F1 failure modes (`path_rejected`, `not_found`, `empty_content`) are all contained within the library return shape; no side-effects. ✓

A developer can implement this unit — flows, rules, entities, and error shapes are unambiguous.
