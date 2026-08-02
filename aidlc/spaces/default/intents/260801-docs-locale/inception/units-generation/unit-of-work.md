# Units of Work — Docs i18n Bolt 2

> ステージ: units-generation / 2026-08-01  
> 計画: Q1–Q5 = A · Plan **Approved**（Looks correct）  
> 上流: [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> 注: 実装順序・critical path は書かない（Delivery Planning 2.8）

## official-docs

| Field | Value |
|-------|-------|
| **Kind** | library |
| **Complexity** | M |
| **Deploy** | shared (workspace package `@aidlc-guide/official-docs`) |
| **Owns** | `resolvePage` keep-path / missing_ja / `anchorApplied`; `listToc`; coverage floor on `resolve.ts` / `roots.ts` / `markdown.ts` |
| **Delivers** | FR-B2-1, FR-B2-2 (resolve half), FR-B2-3, FR-B2-4 (DTO shape), NFR-B2-1, US-B2-01/02/03 library side |
| **Notes** | api-core pass-through is in-process consumer of this unit's API, not a separate Bolt 2 unit (Q1=A). ADR-B2-001/002. |

## docs-shell

| Field | Value |
|-------|-------|
| **Kind** | ui |
| **Complexity** | M |
| **Deploy** | embedded (dashboard Docs Shell in vscode-extension webview) |
| **Owns** | LocaleControl, missing_ja notice (`role=status`), TOC highlight, anchor focus/scroll, localeRequested display; extension-surface acceptance scenarios |
| **Delivers** | FR-B2-2 (UI), FR-B2-4.2, FR-B2-5.2, NFR-B2-3, US-B2-01/02 UI, US-B2-S1 Should |
| **Notes** | Wire-only consumer of `OfficialDocsPage` / TOC. Must not import official-docs. Thin api-core route wiring lands with this unit's integration as needed. ADR-B2-003. |

## Absorbed (not separate units)

| Package | Why absorbed |
|---------|----------------|
| api-core | Pass-through only (Q1=A); no independent Bolt 2 boundary |
| shared-types | Existing contract; both units reference, neither owns a rename |
| vscode-extension | Host surface for docs-shell acceptance; no new host unit |

## Constraints

- Local-only; no AWS / new deployables (Q5=A, services.md)
- Topology only in dependency artifact — no economic sequencing here

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY
**Date:** 2026-08-01

### Checks passed

- **YAML edge block** — present in `unit-of-work-dependency.md`, well-formed, cycle-free. Kinds `library` + `ui` are both valid. Every name in `depends_on` resolves to a declared unit.
- **No build-order prescription** — all three produced files carry explicit "Delivery Planning 2.8" disclaimers. The parallel-development paragraph in the dependency artifact correctly frames sequencing implications as topological truth ("with only one edge, no mutual independence") and defers economic choice to 2.8, not to this stage.
- **Q1–Q5=A honored** — 2 units, correct kinds, `docs-shell depends_on [official-docs]`, api-core/shared-types/vscode-extension correctly absorbed, no new deployables.
- **Story coverage** — US-B2-01, US-B2-02, US-B2-03, US-B2-S1 all assigned; every unit has ≥1 story slice; Won't stories (B3–B5 / #33) correctly omitted.
- **Upstream coverage** — all 7 `consumes:` artifacts (components, component-methods, services, component-dependency, decisions, requirements, stories) are named in headers and cited by name or content ID in prose across the three produced files. The `upstream-coverage` sensor should pass.
- **Integration edge vs. component-dependency.md** — `dashboard ✗ official-docs` (direct import forbidden) is consistent; api-core is correctly absorbed as an implementation-layer detail inside the single DAG edge, not a phantom third unit.
- **Cross-unit contract** — `OfficialDocsPage` / `OfficialDocsToc` / `notice: "missing_ja"` / `anchorApplied` field names match between unit-of-work.md, unit-of-work-dependency.md, and the upstream application-design artifacts.

### Observation (non-blocking)

`decisions.md` ADR-B2-002 Consequences contains "Units: official-docs first, then api-core/dashboard polish" — a sequencing hint embedded in the upstream artifact. The units-generation files correctly do not enshrine this as an ordering decision; the 2.8 boundary is respected. Carry to Delivery Planning as context, not as a 2.7 constraint.
