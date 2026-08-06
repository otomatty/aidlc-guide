# Bolt Plan — Docs i18n Bolt 4 (Construction)

> ステージ: delivery-planning / 2026-08-04  
> Intent: `260802-docs-bridge`  
> 方針: Q1–Q5 = 1 · **1 Construction Bolt** 直列 · **unit-major** · **通常 Bolt**（Walking Skeleton ではない — team.md）  
> 上流: [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md) · [team-practices.md](../practices-discovery/team-practices.md)  
> practices: trunk/`main` · worktree + PR · Walking Skeleton stance inherited but **Bolt 4 = regular** · local-only · solo + PR  
> 注: 製品名「docs-i18n Bolt 4」≠ 下表の Construction Bolt 番号（ここは 1 本のみ）

## Bolt シーケンス（直列）

### Construction Bolt 1: Bridge degrade — docs-navigation

- **Units:** `docs-navigation` (code)
- **Walking skeleton:** no — regular feature bolt (US-06 Bridge degrade / Issue #30); team.md: 「Bolt 4 は Walking Skeleton ではなく通常 Bolt」
- **Stories:** US-B4-01…03 Must; US-B4-S1 Should (optional slice after Must — cuttable)
- **Within-bolt order (Code Generation):** Demo-first then production — fixture proves excerpt non-mount + Open in Docs + Demo CTA, then production Bridge path (Q4=1)
- **DoD (Must):**
  - Legacy Bridge / StageCard docs UI does **not** mount excerpt as article (`docs-excerpt` / equivalent absent) even if API returns `excerpt` (US-B4-01 / ADR-B4-002)
  - Open in Docs is primary CTA; emits `open-official-doc` with Bolt 3 payload shape; host reuses `open-official-doc.ts`; Docs Shell opens; no `openExternal` / remote fetch (US-B4-02 / NFR-B4-1)
  - Final CTA accessible name pinned in Functional Design (FR-B4-2.4)
  - `bun run check` includes UI/contract tests for non-mount + CTA emit; Demo record Bridge → Open in Docs → Shell (US-B4-03 / NFR-B4-2)
  - Extension Webview accept surface only (NFR-B4-3)
- **DoD (Should / optional):** US-B4-S1 glossary/aids may remain if they do not reintroduce excerpt-as-article; absence does **not** fail bolt complete
- **Confidence hypothesis:** 「ドライバーが Bridge を第二正典と誤認せず、Open in Docs から拡張内 Docs Shell に着地できる」
- **Demo:** Legacy Bridge → Open in Docs → Docs Shell（Issue #30）; Demo-first slice before production polish
- **Branching:** worktree from `main` → PR squash-merge into `main` (Q2=1)
- **Gate:** 必須（solo · 人間承認）

## Construction iteration

**unit-major** — 単一 unit のため 3.1–3.4 を `docs-navigation` で一巡（`aidlc-state.ts set-construction-iteration unit-major`）。

## Post-Bolt stages

build-and-test / ci-pipeline は Bolt 後に一度（workflow 既定）。Operation はスコープに従う。
