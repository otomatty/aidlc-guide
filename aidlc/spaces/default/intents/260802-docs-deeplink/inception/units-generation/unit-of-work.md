# Units of Work — Docs i18n Bolt 3

> ステージ: units-generation / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 計画: Q1–Q5 = A · Plan **Approved**（Looks correct）  
> 上流: [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> 注: 実装順序・critical path は書かない（Delivery Planning 2.8）

## docs-navigation

| Field | Value |
|-------|-------|
| **Kind** | ui |
| **Complexity** | M |
| **Deploy** | embedded (dashboard Webview + vscode-extension host; workspace packages) |
| **Owns** | OpenOfficialDocLink（label + emit）; openOfficialDoc host handler; last-used locale in host `globalState`; `docsShellDeepLink` + locale land; mapped/unmapped payload; legacy open off on mapped path; check matrix C1–C7 + demo-record |
| **Delivers** | FR-B3-1…6, NFR-B3-1…3, US-B3-01…06, ADR-B3-001…003 |
| **Notes** | Consumes existing `GET /api/official-docs/stage/:slug` and `STAGE_DOC_MAP` without owning a separate map unit. Must not import `@aidlc-guide/official-docs` from dashboard（component-dependency / dependency-direction.test.ts）. Message type string → Functional Design（FR-B3-1.4）. |

### Within-unit slices (not separate units)

| Slice | Maps to proto-Unit | Packages |
|-------|-------------------|----------|
| Contract payload | U1 | shared-types |
| Host handler + preference | U2 | vscode-extension |
| StageCard wiring | U3 | dashboard |
| Shell locale deep-link | U4 | dashboard DocsShell |

## Absorbed (not separate units)

| Package / concern | Why absorbed |
|-------------------|--------------|
| official-docs STAGE_DOC_MAP | Exists; Bolt 3 does not expand set — regression tests live in this unit's verify slice |
| api-core stage route | Already routed; StageCard is consumer only |
| shared-types | Thin payload DTO owned as slice of this unit |

## Constraints

- Local-only; no AWS / new deployables（Q5=A, services.md）  
- Topology only in dependency artifact — no economic sequencing here  
- Extension Webview accept surface only（NFR-B3-2）

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02 (§12a adversarial sweep)  
**Verdict:** READY

### Checklist passes

| Check | Result |
|-------|--------|
| YAML edge block present, well-formed | ✓ `unit-of-work-dependency.md` — single `docs-navigation` unit |
| `kind: ui` valid | ✓ |
| `depends_on: []` — cycle-free | ✓ Single-unit DAG; no edges possible |
| No build-order / critical-path in units-generation outputs | ✓ Explicitly disclaimed in both `unit-of-work.md` header and `unit-of-work-dependency.md` ("Topology only") |
| Q1–Q5=A honored | ✓ Single unit, granularity via within-unit slices, topology-only DAG, kind=ui, local-only deploy |
| All US-B3-01…06 mapped | ✓ All 6 Must stories assigned to `docs-navigation`; Won't stories correctly omitted |
| Every consumes artifact referenced | ✓ All seven upstream artifacts cross-linked in all three stage outputs |
| Single-unit DAG intentional | ✓ Q3=A documented; rationale explicit (Bolt 1/2 prerequisites outside DAG; runtime hop is intra-unit integration detail) |

### Findings

**F1 (MINOR) — Build-order hint in upstream consumed artifact.**  
`component-dependency.md` § "Build order hint" carries a numbered 5-step economic sequence (shared-types → official-docs → extension → dashboard → check). This is in an upstream application-design artifact (already reviewed READY in `components.md`), not in any units-generation output. The units-generation artifacts correctly exclude build order. The hint should migrate to Delivery Planning 2.8; leaving it in `component-dependency.md` is harmless today but creates a risk that implementers treat it as prescribed sequencing.  
*Action (non-blocking):* Move or explicitly relabel the build-order hint as "illustrative; non-normative; see Delivery Planning 2.8 for sequencing."

**F2 (MINOR) — Stale review notes in four upstream files.**  
`component-dependency.md`, `component-methods.md`, `services.md`, and `decisions.md` each carry a "Review note" footer from the prior review pass showing BLOCKER or MODERATE findings as if open. The findings are fully resolved in those files' own bodies and confirmed CLOSED in the `components.md` consolidated re-review. A developer reading any single file in isolation will encounter an apparently-live BLOCKER and must cross-check `components.md` to confirm it is closed.  
*Action (non-blocking):* Update each stale footer to "CLOSED — resolved per `components.md` re-review 2026-08-02."

**F3 (MINOR) — Numbered within-unit slices could be misread as prescribed order.**  
`unit-of-work-story-map.md` § "Within-unit story slices" uses a numbered list 1–5. The section heading says "(topology-neutral)" but conventional numbering implies sequence. `unit-of-work-dependency.md` explicitly defers slice parallelism to Delivery Planning 2.8; the same note should appear inline in the story-map.  
*Action (non-blocking):* Add "(numbers are labels, not implementation order; see Delivery Planning 2.8)" after the section heading.

### Summary

Three minor findings, zero blockers. All core structural requirements satisfied: YAML block valid, no build-order prescription in units-generation outputs, Q1–Q5=A honored, US-B3-01…06 fully mapped, all consumed artifacts cross-referenced, single-unit DAG documented as intentional. Construction can start without architectural questions beyond these artifacts.
