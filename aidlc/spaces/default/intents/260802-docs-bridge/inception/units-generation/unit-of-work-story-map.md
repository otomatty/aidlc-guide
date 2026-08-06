# Unit ↔ Story Map — Docs i18n Bolt 4

> ステージ: units-generation / 2026-08-04  
> 上流: [unit-of-work.md](./unit-of-work.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md)

## Must stories → Unit

| Story | Unit | FR / NFR |
|-------|------|----------|
| US-B4-01 Excerpt non-mount | docs-navigation | FR-B4-1 |
| US-B4-02 Open in Docs primary | docs-navigation | FR-B4-2, NFR-B4-1, NFR-B4-3 |
| US-B4-03 Demo + check | docs-navigation | FR-B4-3, NFR-B4-2 |

## Should

| Story | Unit | Notes |
|-------|------|-------|
| US-B4-S1 Glossary aids | docs-navigation | Optional; non-failing for DoD |

## Won't (unmapped)

B3 reimplementation, B5 diff report, locale rework, terminal inject, cloud, workflows — no unit assignment.

## Coverage check

All Must FR-B4-1…3 / NFR-B4-1…3 appear via US-B4-01…03 → `docs-navigation`.
