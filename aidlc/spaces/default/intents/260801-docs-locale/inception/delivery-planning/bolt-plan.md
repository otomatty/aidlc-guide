# Bolt Plan — Docs i18n Bolt 2 (Construction)

> ステージ: delivery-planning / 2026-08-02  
> 方針: Q1–Q6 = A · 2 Bolts 直列 · **unit-major** · Bolt 1 = walking skeleton  
> 上流: [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md)  
> practices: trunk/`main` · Walking Skeleton **on**（Bolt 1 ソロ・ゲート）· local-only · team-formation SKIP  
> 注: 製品名「docs-i18n Bolt 2」≠ 下表の Construction Bolt 番号

## Bolt シーケンス（直列）

### Construction Bolt 1: walking skeleton — official-docs

- **Units:** `official-docs` (library)
- **Walking skeleton:** yes — layers: FS locale trees → `resolvePage` / `listToc` / guardPath → wire-shaped `OfficialDocsPage` (api-core pass-through as integration, not a separate unit)
- **Stories focus:** US-B2-01 / US-B2-02 (library AC) + US-B2-03 coverage floor
- **DoD:**
  - keep-path: resolve always returns requested `path`
  - missing_ja → en body + `notice="missing_ja"`; localeRequested stays ja at DTO level
  - `anchorApplied` ∈ {scrolled, top, none}
  - branch coverage ≥ 95% on `resolve.ts` / `roots.ts` / `markdown.ts` in `bun run check`
  - HTTP mapping: success/`missing_ja` = 200; `not_found` = 404 ≠ untranslated
- **Confidence hypothesis:** 「部分 ja でも resolve 契約（path / notice / anchor / coverage）が `bun run check` で壊れない」
- **Demo:** failing→passing coverage + fixture cases for missing_ja / missing-anchor
- **Gate:** 必須（solo · 人間承認後に続行 / ラダープロンプト）

### Construction Bolt 2: docs-shell UI

- **Units:** `docs-shell` (ui)
- **Walking skeleton:** no
- **Stories:** US-B2-01 / US-B2-02 (UI) + US-B2-03 manual scenarios + US-B2-S1 Should
- **DoD:**
  - LocaleControl keep-path display from response `path`
  - notice banner iff `notice==="missing_ja"` with `role=status`
  - `syncTocHighlight` + `applyAnchor` per refined mockups / component-methods
  - Extension Docs Shell manual scenarios recorded (FR-B2-5.2)
  - h1 Should attempted (non-fail)
- **Confidence hypothesis:** 「拡張 Docs Shell で S-docs-1（部分 ja）の切替体験が成立する」
- **Demo:** Extension: en↔ja same path + missing_ja notice + missing-anchor → top
- **Gate:** per Construction Autonomy Mode after ladder

## Construction iteration

**unit-major** — Unit ごとに 3.1–3.4 を揃えてから次 Unit（`aidlc-state.ts set-construction-iteration unit-major`）。

## Post-Bolt stages

build-and-test / ci-pipeline は全 Bolt 後に一度（workflow 既定）。Operation はスコープに従う。
