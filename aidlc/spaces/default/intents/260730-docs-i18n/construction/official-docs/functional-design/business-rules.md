# Business Rules — Unit: official-docs

> functional-design / official-docs (library) / 2026-07-31  
> 上流: requirements.md · stories US-02–05 · component-methods.md · domain-entities.md

| ID | Rule | Source |
|----|------|--------|
| BR-OD-1 | Content roots are `docs/guide/<locale>/` and `docs/reference/<locale>/` only | FR-U1.1 · practices |
| BR-OD-2 | Every FS read uses `guardPath` against the active locale content root | NFR-2 |
| BR-OD-3 | Escape / outside-root paths → `path_rejected` (never raw FS) | NFR-2 · US-02 |
| BR-OD-4 | Requested `ja` with missing file → serve `en` body + `notice=missing_ja`; do not invent ja | FR-U2.5 · US-04 |
| BR-OD-5 | Anchor present and found → `anchorApplied=scrolled`; present but missing or absent → `top` (US-03 precedent) | FR-U2.3 · US-03/05 |
| BR-OD-6 | Manifest required fields non-empty or result `empty_content` | FR-U1.2 |
| BR-OD-7 | `mapStageToDoc` covers exactly the seven FR-U3.3 slugs; others → null | FR-U3.3 · US-05 |
| BR-OD-8 | Module branch coverage ≥ 95% | NFR-3 · practices |
| BR-OD-9 | No network I/O inside this library | NFR-1 |

## Errors

Prefer Result kinds: `ok` | `not_found` | `missing_ja` | `path_rejected` | `empty_content` (component-methods.md).
