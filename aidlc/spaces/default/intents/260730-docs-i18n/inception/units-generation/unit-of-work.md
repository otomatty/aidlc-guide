# Units of Work — Docs i18n

> ステージ: units-generation / 2026-07-31  
> 計画: Q1–Q5 = A · Plan **Approved**（推奨分解）  
> 上流: [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> 注: 実装順序・critical path は書かない（Delivery Planning 2.8）

## content-snapshot

| Field | Value |
|-------|-------|
| **Kind** | packaging |
| **Complexity** | M |
| **Deploy** | shared (repo trees in VSIX content) |
| **Owns** | `docs/guide\|reference/<locale>/` en bootstrap (+ ≥1 ja page), `docs/official-docs.manifest.json` |
| **Delivers** | FR-U1, FR-U5.2 bootstrap; US-01, US-07 content half |
| **Notes** | Distinct from product `docs/guides/`. No UI. Ingest script optional if trees committed. |

## official-docs

| Field | Value |
|-------|-------|
| **Kind** | library |
| **Complexity** | L |
| **Deploy** | shared (workspace package) |
| **Owns** | `@aidlc-guide/official-docs`: resolvePage, listToc, readManifest, mapStageToDoc, guardPath usage |
| **Delivers** | NFR-2/3 seam; FR-U2.3/2.5 resolve rules; FR-U3.3 map data |
| **Notes** | Fixture-testable without full snapshot; 95% branch coverage Must. ADR-001. |

## docs-api

| Field | Value |
|-------|-------|
| **Kind** | library |
| **Complexity** | M |
| **Deploy** | embedded in api-core / hosts |
| **Owns** | `GET /api/official-docs/:locale/*` (+ manifest as designed); no collision with `/api/guides`, `/api/docs-settings` |
| **Delivers** | FR-U2.6; ReadResult shaping per component-methods |
| **Notes** | ADR-002 host cut does not change this unit — routes live in api-core. |

## docs-shell

| Field | Value |
|-------|-------|
| **Kind** | ui |
| **Complexity** | L |
| **Deploy** | embedded (dashboard webview in VSIX) |
| **Owns** | Docs Shell RM1–RM2: TOC, body, LocaleControl, UntranslatedNotice, sourceVersion header, locale preference consumer |
| **Delivers** | US-02, US-03, US-04; S-docs-1 reader surface |
| **Notes** | Wire only → docs-api. Reuse MarkdownSurface. NFR-7 Should checklist. |

## docs-navigation

| Field | Value |
|-------|-------|
| **Kind** | ui |
| **Complexity** | M |
| **Deploy** | embedded (dashboard + vscode-extension command) |
| **Owns** | StageCard OpenOfficialDocLink, openOfficialDoc host handler, BridgeRedirectPanel; optional US-09 glossary |
| **Delivers** | US-05, US-06; FR-U3, FR-U4 |
| **Notes** | Depends on shell being openable. Command name string → Functional Design. |

## diff-report

| Field | Value |
|-------|-------|
| **Kind** | packaging |
| **Complexity** | S |
| **Deploy** | shared (script/tooling; not runtime service) |
| **Owns** | Upstream vs snapshot diff report generator (Should) |
| **Delivers** | US-08 / FR-U6 — cuttable without blocking S-docs-1 |
| **Notes** | Output format Open Question → Functional Design. |

## Coverage summary

| proto-Unit | Construction units |
|------------|-------------------|
| U1 | content-snapshot |
| U2 | official-docs + docs-api + docs-shell |
| U3 | docs-navigation |
| U4 | docs-navigation |
| U5 | content-snapshot (+ process note) |
| U6 Should | diff-report |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-07-31

---

### YAML edge block — structural checks

Block is present in `unit-of-work-dependency.md`. Structural pass:

| Check | Result |
|-------|--------|
| Well-formed YAML | ✓ — valid list-of-dicts; all entries have `name`, `kind`, `depends_on` |
| Cycle-free | ✓ — two independent subgraphs; no back-edge (traced below) |
| Kinds valid | ✓ — `packaging`, `library`, `ui` all appropriate to their units |

Cycle trace:

```
content-snapshot (no deps)
official-docs   (no deps)
docs-api        → official-docs           (acyclic)
docs-shell      → docs-api → official-docs (acyclic)
docs-navigation → docs-shell → …          (acyclic)
diff-report     → content-snapshot        (acyclic)
```

No back-edges. DAG is sound.

---

### 2.8 boundary — no build order / critical path

Both files carry the explicit header "no recommended build order / critical path (that is Delivery Planning 2.8)." The "Parallel development opportunities" section in `unit-of-work-dependency.md` describes topology (which sets share no mutual dependency), which is the correct scope here.

**Minor observation (non-blocking):** Item 2 in that section reads "shell work is gated on api; navigation gated on shell" — the word "gated" has a scheduling connotation. The underlying statement is topologically correct (the dependency edges mandate it) and the framing is "opportunities," not a sprint plan. No action required; a future pass may rephrase to pure topology language.

---

### Story coverage — every story mapped, every unit has stories

Cross-referenced `unit-of-work-story-map.md` against `stories.md`:

| Story | Priority | Assigned? | Unit |
|-------|----------|-----------|------|
| US-01 | Must | ✓ | content-snapshot |
| US-02 | Must | ✓ | official-docs + docs-api + docs-shell |
| US-03 | Must | ✓ | docs-shell |
| US-04 | Must | ✓ | docs-shell |
| US-05 | Must | ✓ | docs-navigation |
| US-06 | Must | ✓ | docs-navigation |
| US-07 | Must | ✓ | content-snapshot |
| US-08 | Should | ✓ | diff-report |
| US-09 | Should | ✓ | docs-navigation |

Every unit has ≥1 story:

| Unit | Stories |
|------|---------|
| content-snapshot | US-01, US-07 |
| official-docs | US-02 (primary), US-03/04/05 (support) |
| docs-api | US-02 |
| docs-shell | US-02, US-03, US-04 |
| docs-navigation | US-05, US-06, US-09 |
| diff-report | US-08 |

Coverage is complete. US-09 (Could) correctly omitted from Must units.

---

### ADR-001–006 alignment

| ADR | Decision | Unit(s) that carry it | Aligned? |
|-----|----------|----------------------|----------|
| 001 | `@aidlc-guide/official-docs` domain package | `official-docs` (kind: library) | ✓ |
| 002 | Extension-first host cut | All units deploy in VSIX / embedded; no standalone services | ✓ |
| 003 | `mapStageToDoc` lives in official-docs | `docs-navigation` delivers FR-U3 via "official-docs map" integration | ✓ |
| 004 | Locale preference in `workspaceState` | `docs-navigation` owns openOfficialDoc handler + locale payload | ✓ |
| 005 | Sync request/response only | All integration contracts in dependency table are sync (no queue, no event bus) | ✓ |
| 006 | Bridge UI degrade; keep docs-bridge | `docs-navigation` owns BridgeRedirectPanel; docs-bridge referenced correctly as narrow | ✓ |

---

### Component alignment

Every component from `components.md` maps to a unit or is correctly excluded:

| Component | Unit | Note |
|-----------|------|------|
| official-docs (new) | `official-docs` | ✓ |
| api-core (extend) | `docs-api` | ✓ — embedded in api-core |
| dashboard (extend) | `docs-shell` + `docs-navigation` | ✓ — split by concern |
| vscode-extension (extend) | `docs-navigation` | ✓ — openOfficialDoc handler |
| docs-bridge (narrow) | `docs-navigation` notes | ✓ — narrowing, not a new unit |
| shared-types (extend) | — | ✓ — shared contract; no work unit needed |
| core-utils (reuse) | — | ✓ — unchanged; no work unit needed |

---

### Kind tags

| Unit | Kind | Rationale | Sound? |
|------|------|-----------|--------|
| content-snapshot | packaging | Repo trees + manifest; no runtime API | ✓ |
| official-docs | library | Pure domain functions; fixture-testable in isolation | ✓ |
| docs-api | library | Route handlers embedded in api-core; not a separate service | ✓ |
| docs-shell | ui | Dashboard webview component | ✓ |
| docs-navigation | ui | Dashboard + extension command surface | ✓ |
| diff-report | packaging | Script/tooling artifact; not a runtime service | ✓ |

---

### Integration contract spot-check

The `docs-navigation → docs-api (via host)` row in the integration table appears in the prose but **not** in the YAML `depends_on` for `docs-navigation`. The "(via host)" qualifier is the correct reason: docs-navigation does not directly import docs-api; it fires an extension command that the vscode-extension host services via api-core. The YAML dependency graph captures code/build dependencies, not runtime call paths. The integration table correctly documents the runtime path.

**Minor observation (non-blocking):** A one-line inline comment in the YAML noting that `docs-navigation → docs-api` is a runtime path (not a build dep) would preempt a future developer question. Not required for construction start.

---

### Verdict rationale

A developer can determine unit scope, integration contracts, dependency direction, ADR rationale, and story assignment from these three artifacts without returning with architectural questions. The YAML is structurally valid and cycle-free. All nine Must/Should stories are mapped. Every unit has work. All six ADRs are traceable to specific units. Kind tags are correct. The two minor observations above are cosmetic and do not introduce implementation ambiguity.
