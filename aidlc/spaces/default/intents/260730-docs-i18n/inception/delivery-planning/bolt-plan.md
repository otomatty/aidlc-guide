# Bolt Plan — Docs i18n

> ステージ: delivery-planning / 2026-07-31  
> 方針: Q1=A hybrid walking-skeleton + M5→M1/M2 · Q2=A 5 Bolts · Q3=A 直列 · Q4=A **unit-major**  
> 上流: [unit-of-work.md](../units-generation/unit-of-work.md) · [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md) · [unit-of-work-story-map.md](../units-generation/unit-of-work-story-map.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [mockups.md](../refined-mockups/mockups.md) · [components.md](../application-design/components.md) · [team-practices.md](../practices-discovery/team-practices.md)  
> practices: trunk/`main` · Walking Skeleton **on**（Bolt 1 ソロ・ゲート）· local-only

## Bolt シーケンス（直列。B5 は Should・切下げ可）

### Bolt 1: walking skeleton

- **Units:** content-snapshot + official-docs + docs-api + docs-shell（薄い縦スライス）
- **Walking skeleton:** yes — layers: FS trees/manifest → official-docs (`guardPath`) → api-core `/api/official-docs/:locale/*` → dashboard Docs Shell（1 ページ + `sourceVersion`）
- **Stories focus:** US-01 (minimal) + US-02 happy path (en page offline)
- **DoD:** `docs/guide/en` + `docs/reference/en` non-empty + manifest fields; resolvePage + route green with NFR-2 negative in `bun run check`; Shell opens one page offline showing `sourceVersion`; locale control present (full ja matrix can land in B2)
- **Confidence hypothesis:** 「同梱 FS → official-docs → api-core → Webview の一方向が、`/api/guides` と衝突せず成立する」
- **Demo:** Extension Docs Shell で en ページ表示 + ヘッダ版表示
- **Gate:** 必須（solo · 人間承認後に続行 / ラダープロンプト）

### Bolt 2: Locale + untranslated

- **Units:** docs-shell（完成）+ official-docs（missing_ja / anchor 分岐の残）
- **Stories:** US-03, US-04（NFR-3 95% をこの Bolt で満たす）
- **DoD:** en↔ja keep-path; missing anchor → top; missing ja → notice + `role=status` + locale stays ja; coverage floor on official-docs
- **Confidence hypothesis:** 「部分 ja でも S-docs-1 の切替体験が迷わず成立する」
- **Demo:** 同一 path で locale 切替 + 未訳 notice

### Bolt 3: Deep links

- **Units:** docs-navigation（StageCard + openOfficialDoc）
- **Stories:** US-05
- **DoD:** 7 slug map; label ≠ bare `Docs`; payload `{locale,path,anchor?}`; no external browser; unmapped → Shell top
- **Confidence hypothesis:** 「ドライバーが StageCard から拡張内 docs に着地できる」
- **Demo:** intent-capture StageCard → Docs Shell 着地

### Bolt 4: Bridge degrade

- **Units:** docs-navigation（BridgeRedirectPanel; US-09 optional）
- **Stories:** US-06（US-09 Should 任意）
- **DoD:** excerpt not mounted as article; Open in Docs primary; optional glossary cuttable
- **Confidence hypothesis:** 「正本は同梱 Docs のみ」
- **Demo:** Legacy Bridge → Open in Docs → Shell

### Bolt 5: Diff report（Should · cuttable）

- **Units:** diff-report
- **Stories:** US-08
- **DoD:** Report from upstream vs snapshot usable as translate-PR input; may skip without blocking S-docs-1
- **Confidence hypothesis:** 「upstream 差分が見えると U5 運用が回る」
- **Demo:** 差分レポート 1 本生成（形式は FD で固定）

## US-07 placement

Bootstrap ja page ships with **Bolt 1** content-snapshot. Ongoing PR process is constraint (not a separate Bolt).

## Construction iteration

**unit-major** — record via `aidlc-state.ts set-construction-iteration unit-major`.

## Post-Bolt stages

build-and-test / ci-pipeline run after Bolts per workflow plan (not per-Bolt). Operation stages SKIP.
