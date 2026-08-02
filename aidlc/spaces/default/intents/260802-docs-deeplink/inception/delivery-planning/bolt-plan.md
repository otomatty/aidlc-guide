# Bolt Plan — Docs i18n Bolt 3 (Construction)

> ステージ: delivery-planning / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 方針: Q1–Q6 = A · **1 Construction Bolt** 直列 · **unit-major** · Bolt 1 = walking skeleton  
> 上流: [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md)  
> practices: trunk/`main` · Walking Skeleton **on**（Bolt 1 ソロ・ゲート）· local-only · team-formation SKIP  
> 注: 製品名「docs-i18n Bolt 3」≠ 下表の Construction Bolt 番号（ここは 1 本のみ）

## Bolt シーケンス（直列）

### Construction Bolt 1: walking skeleton — docs-navigation

- **Units:** `docs-navigation` (ui)
- **Walking skeleton:** yes — layers: StageCard OpenOfficialDocLink → api-core stage-map wire → vscode-extension openOfficialDoc handler + locale preference → DocsShell deep-link（locale/path/anchor）one-shot → no external browser
- **Stories:** US-B3-01…06（all Must）
- **DoD:**
  - Mapped payload `{ locale, path, anchor? }` with non-empty `path`; unmapped `{ locale }` only（omit path keys）
  - Label accessible name includes stage name（≠ bare `Docs`）
  - Shell lands path/locale/anchor per FR-B3-4; one-shot consume
  - Legacy `docsOpenHref` / `open-doc` unused on mapped StageCard path
  - `bun run check` covers C1–C7（map, payloads, top, label, legacy-off, no remote fetch）
  - demo-record.md for intent-capture StageCard → Shell（PASS/FAIL）
- **Confidence hypothesis:** 「ドライバーが StageCard から拡張内 Docs Shell に着地でき、外部ブラウザなしで説明が続く」
- **Demo:** intent-capture StageCard docs link → Docs Shell on map path（Issue #29）
- **Gate:** 必須（solo · 人間承認後に続行 / ラダープロンプト）

## Construction iteration

**unit-major** — 単一 unit のため 3.1–3.4 を `docs-navigation` で一巡（`aidlc-state.ts set-construction-iteration unit-major`）。

## Post-Bolt stages

build-and-test / ci-pipeline は Bolt 後に一度（workflow 既定）。Operation はスコープに従う。
