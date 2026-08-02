# Business Rules — Unit: official-docs (Bolt 2)

> functional-design / official-docs (library) / 2026-08-02  
> 上流: [requirements.md](../../../inception/requirements-analysis/requirements.md) · [component-methods.md](../../../inception/application-design/component-methods.md) · [components.md](../../../inception/application-design/components.md) · [services.md](../../../inception/application-design/services.md) · [unit-of-work.md](../../../inception/units-generation/unit-of-work.md) · [unit-of-work-story-map.md](../../../inception/units-generation/unit-of-work-story-map.md)

## Rules

| ID | Rule | Source |
|----|------|--------|
| BR-B2-OD-1 | Output `path` equals requested path even when ja file missing | FR-B2-1.1 · Q1=A |
| BR-B2-OD-2 | `locale=ja` + missing ja + en exists → ok page with `notice=missing_ja`, `localeServed=en` | FR-B2-2.1 · Q2=A |
| BR-B2-OD-3 | Both locales missing file → `not_found` (not missing_ja) | FR-B2-2 / Q2=A |
| BR-B2-OD-4 | Anchor found → `scrolled`; requested missing → `top`; absent → `none` | FR-B2-3 · Q3=A |
| BR-B2-OD-5 | `listToc(locale)` reflects that locale tree only (no forced en∪ja union) | FR-B2-1.2/1.3 · Q4=A |
| BR-B2-OD-6 | Every FS read uses `guardPath`; escape → `path_rejected` | NFR-B2-2 / parent NFR-2 |
| BR-B2-OD-7 | No network I/O in this library | NFR-B2-2 |
| BR-B2-OD-8 | Branch coverage ≥ 95% on `resolve.ts`, `roots.ts`, `markdown.ts` via `bun run check` | NFR-B2-1 · Q5=A |
| BR-B2-OD-9 | Do not rename wire fields (`notice`, `anchorApplied`, …) | FR-B2-4.3 · ADR-B2-001 |

## Review

**Reviewer:** aidlc-architecture-reviewer-agent
**Verdict:** READY — see full review in [business-logic-model.md § Review](./business-logic-model.md#review).

`## Rules` + `## Errors` present (≥2 H2s). All rule IDs resolve. No defects.

---

## Errors

| Kind | Meaning |
|------|---------|
| ok (+ optional notice) | Page loaded (incl. missing_ja success shape) |
| not_found | Path unknown in en (or both) |
| path_rejected | guardPath failed |
| empty_content | Manifest/snapshot missing |
