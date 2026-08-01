# Business Logic Model — Unit: official-docs

> functional-design / official-docs (library) / 2026-07-31  
> 上流: components.md · component-methods.md · services.md · requirements.md · stories.md · unit-of-work-story-map.md

## Purpose

Locale-scoped load/resolve for bundled official docs. Pure library — no HTTP, no React.

## Flows

### F1 — resolvePage

```text
input(workspaceRoot, locale, path, anchor?)
  → validate locale ∈ {en,ja}
  → contentRoot = docs/guide|reference split by path prefix rules
  → guardPath(contentRoot, path) else path_rejected
  → if file missing && locale=ja → load en twin → missing_ja notice
  → if file missing && locale=en → not_found
  → read body + manifest.sourceVersion
  → apply anchor rule (scrolled|top|none)
  → ResolvedPage
```

### F2 — listToc

Scan locale trees → TocTree (en structure authoritative when ja sparse — detail: prefer union of paths with en titles fallback).

### F3 — readManifest

Read `docs/official-docs.manifest.json` → Manifest or empty_content.

### F4 — mapStageToDoc

Static table lookup → StageDocRef | null.

## Invariants

- Dashboard must never import this package (structural ban).  
- Single containment enforcement via `core-utils.guardPath`.  

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31

Flows cover FR-U2.3/2.5, NFR-1/2/3 seams, and FR-U3.3 map without UI leakage.
