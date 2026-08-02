# Unit ↔ Story Map — Docs i18n Bolt 2

> ステージ: units-generation / 2026-08-01  
> 上流: [unit-of-work.md](./unit-of-work.md) · [unit-of-work-dependency.md](./unit-of-work-dependency.md) · [stories.md](../user-stories/stories.md) · [requirements.md](../requirements-analysis/requirements.md) · [components.md](../application-design/components.md) · [component-methods.md](../application-design/component-methods.md) · [services.md](../application-design/services.md) · [component-dependency.md](../application-design/component-dependency.md) · [decisions.md](../application-design/decisions.md)

## Story → unit(s)

| Story | Primary unit | Supporting | Notes |
|-------|--------------|------------|-------|
| US-B2-01 | official-docs + docs-shell | — | Cross-cutting: resolve keep-path/anchor + UI locale/TOC/focus |
| US-B2-02 | official-docs + docs-shell | — | Cross-cutting: notice on wire + `role=status` banner |
| US-B2-03 | official-docs | docs-shell | Coverage floor on library; manual scenarios on extension Shell |
| US-B2-S1 | docs-shell | — | Should h1 polish; non-fail |

## Cross-cutting stories

| Story | Why multi-unit |
|-------|----------------|
| US-B2-01 | Library owns path/anchorApplied; UI owns control + TOC highlight + focus |
| US-B2-02 | Library emits `notice=missing_ja`; UI renders only that signal |

## Within-unit story slices (topology-neutral)

### official-docs

1. keep-path + missing_ja resolve branches (US-B2-01/02 library AC)
2. anchorApplied scrolled/top/none (US-B2-01)
3. listToc for highlight consumers (US-B2-01)
4. coverage ≥95% on resolve/roots/markdown (US-B2-03)

### docs-shell

1. LocaleControl + keep displaying response path (US-B2-01)
2. Notice banner + syncTocHighlight + applyAnchor (US-B2-01/02)
3. Manual extension scenarios record (US-B2-03)
4. h1 Should (US-B2-S1)

## Coverage check

| Check | Status |
|-------|--------|
| Every Must/Should story assigned | Yes — US-B2-01, 02, 03, S1 |
| Every unit has ≥1 story | Yes |
| Won't stories assigned | No — correctly omitted (B3–B5 / #33) |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY — see full review in [unit-of-work.md § Review](./unit-of-work.md#review).
