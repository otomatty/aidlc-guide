# Units of Work — Docs i18n Bolt 4

> ステージ: units-generation / 2026-08-04  
> Intent: `260802-docs-bridge`  
> 計画: Q1–Q5 = A · Looks correct  
> 上流: [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> 注: 実装順序・critical path は書かない（Delivery Planning 2.8）

## docs-navigation

| Field | Value |
|-------|-------|
| **Kind** | ui |
| **Complexity** | S–M |
| **Deploy** | monolithic (same repo / VSIX; Q5=A) |
| **Owns** | Bridge / StageCard excerpt 非マウント; Open in Docs primary CTA → `open-official-doc` emit; host handler **reuse** (minimal regression); US-06 UI/契約テスト + Demo record |
| **Delivers** | FR-B4-1…3, NFR-B4-1…3, US-B4-01…03; Should US-B4-S1 optional; ADR-B4-001…002 |
| **Notes** | Consumes completed Bolt 3 `open-official-doc` / Docs Shell land as **external prerequisite** (not a unit edge). No new packages. Final CTA accessible name → Functional Design. |

### Within-unit slices (not separate units)

| Slice | Packages |
|-------|----------|
| Excerpt non-mount | dashboard StageCard / Bridge |
| Open in Docs CTA emit | dashboard (`OpenOfficialDocLink` pattern) |
| Host reuse / regression | vscode-extension `open-official-doc.ts` |
| Verify (check + Demo) | dashboard tests (+ host spy as needed) |

## Absorbed (not separate units)

| Concern | Why |
|---------|-----|
| official-docs / api-core | Unchanged consumers of Shell; not Bolt 4 owners |
| docs-bridge excerpt wire | UI-only Must (Q3=A / ADR-B4-002) |
| US-B4-S1 glossary | Should; same unit if kept |

## Constraints

- Local-only; no AWS / new deployables（services.md / Q5=A）  
- Topology only in dependency artifact — no economic sequencing here  
- Extension Webview accept surface only（NFR-B4-3）

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Verdict:** READY  
**Date:** 2026-08-04  
**Note:** Inline review. Single-unit DAG matches Q1–Q3=A; no build-order claims.
