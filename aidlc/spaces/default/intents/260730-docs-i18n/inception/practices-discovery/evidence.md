# Practices Discovery — Evidence

> Intent: `260730-docs-i18n` · Integrated 2026-07-31 · HEAD `7148a19`

## Sources inspected

- `aidlc/spaces/default/memory/{org,team,project}.md`
- CodeKB: architecture, code-structure, technology-stack, dependencies, code-quality-assessment, business-overview
- Lead draft + contributions: quality / developer / devsecops
- Interview: `practices-discovery-questions.md`

## Interview decisions

| ID | Answer | Meaning |
|----|--------|---------|
| Q1 | C | Reuse team.md Walking Skeleton; no docs-specific skeleton ceremony |
| Q2 | A | Locale resolver/loader: 95% branch coverage Must |
| Q3 | C | VSIX size monitoring deferred to NFR |
| Q4 | A | Locale codes `en` / `ja` |
| Q5 | A | `docs/guide\|reference/<locale>/...` |
| Q6 | A | `/api/official-docs/:locale/*` |
| Q7 | A | Inherit all team.md practices |
| Q8 | A | Must: guardPath + locale root negative tests in `bun run check` |

## Spoke positions folded in

| Spoke | Accepted |
|-------|----------|
| quality | 95% locale floor; single Vitest/`bun run check` gate |
| developer | api-core (not reader-core/dashboard) loader; avoid `/api/docs` collision → official-docs |
| devsecops | Containment negative tests as Must; VSIX package hygiene (secrets) even if size gate deferred |

## Deferred / unresolved

- Numeric VSIX MB budget (explicitly deferred by Q3 = C to NFR)
- Exact Bolt slicing of M5 vs M1 remains delivery-planning / units-generation concern under inherited skeleton stance
