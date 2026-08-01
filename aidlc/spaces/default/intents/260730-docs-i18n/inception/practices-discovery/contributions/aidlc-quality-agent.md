**Collaborator:** aidlc-quality-agent

## Contribution

Testing-posture assessment of the lead draft for `260730-docs-i18n`. Baseline Testing Posture in `team.md` (Vitest, branch coverage on parse, ~80% UI line, `bun run check` as sole gate) is correctly carried forward and matches codekb evidence (`code-quality-assessment.md`, `technology-stack.md`). No runner change is warranted. The draft’s gaps that matter for Construction are (1) whether the new locale resolver inherits the parse-tier 95% **branch** floor, (2) whether VSIX size is a hard step inside `bun run check`, and (3) under-tested host/api surfaces that docs-i18n will stress.

### 1. Vitest + coverage tooling — affirm, do not reopen

Lead correctly keeps **Vitest** (dual projects: `node` + `dashboard` jsdom) with `@vitest/coverage-v8`, Testing Library, and fast-check. `bun test` remains disqualified for the same reason as the prior affirmation: no branch coverage. Dev-time Vitest is already DECIDED as non-conflicting with C-T1 — do not re-litigate at this interview.

**Integration note for the lead:** Affirm that locale-resolver/loader unit tests land in the **node** Vitest project (same coverage machinery as parse/), and locale-switcher UI tests land in the **dashboard** jsdom project. Thresholds belong in `vitest.config.ts` (or package-level vitest configs already used by the monorepo), not in prose-only checklists.

### 2. Locale resolver / content loader — endorse 95% branch (Q-Test-1)

Locale resolution is the new risk center for this intent: missing locale, missing page, path escape attempts, empty trees, fallback vs hard-fail. That is the same class of pure domain logic as `reader-core/src/parse/**`. Soft “aim for coverage” will leave the error branches untested.

**Quality recommendation to affirm:** New locale resolver/content-loader modules carry the **same 95% branch coverage floor** as `packages/reader-core/src/parse/**`. Wire the floor in Vitest coverage thresholds for those paths. Pair with:

- Table-driven unit tests on synthetic en/ja fixture trees (lead’s fixture policy — **agree**; never pin unit tests to the full upstream snapshot).
- Explicit negative cases: unknown locale → discriminable error; missing path → not-found; path outside tree → blocked via `guardPath` (Mandated rule already drafts this).
- Golden asserts on a tiny fixture tree only (deterministic, repo-size stable).

Answer **Q-Test-1 = yes** unless the team consciously accepts a lower floor; “similar criticality to parse” is the correct default.

### 3. Coverage floors for adjacent surfaces — harden soft language

Lead proposes:

| Surface | Draft floor | Quality stance |
|---------|-------------|----------------|
| Locale resolver/loader | 95% branch (open Q-Test-1) | Affirm as hard floor |
| Dashboard locale UI | ~80% line | Keep as UI aggregate floor |
| New api-core docs routes | “aim for 80%” | **Harden to a hard 80% line (or branch where handlers branch heavily)** — “aim for” is not a gate |

api-core today is ~4 test files against orchestration importance (`code-quality-assessment.md`). Docs routes are multi-host (HTTP + postMessage) — Mandated already requires both transports. Tests must cover the **handler contract** once (api-core) plus at least one smoke per transport binding; do not duplicate full suites in dashboard-server and vscode-extension.

**Extension host (D8):** Lead notes thinness (2 files) and path-containment risk but does not give it an interview ID. For docs-i18n, bundled trees + `open-doc` locale paths make this a **P0 test investment**, not optional debt. Recommend affirming: Construction for M1/M2 includes host tests for locale-scoped open-doc and path containment (not only dashboard/api-core units).

### 4. CI / quality gate — keep single script; add size as enforced step

Draft correctly reaffirms `bun run check` as the single gate definition (project.md `ci-pipeline:c2`). New docs-i18n checks must chain into that script, not appear only in README or as a separate GHA job.

**VSIX size (Q-Test-2 + Q-Deploy-1):** Advisory-only is the wrong answer for D5 (committed large media, silent drift, Biome ignores `packages/vscode-extension/media`). Quality stance:

1. Affirm a numeric **VSIX (or packaged media) budget** at the interview (**Q-Deploy-1** must produce a number or a formula, e.g. current baseline + N MB headroom).
2. Enforce via a `check:size` (or equivalent) step **chained into** root `check` (**Q-Test-2 = enforced**, not advisory).
3. Apply project deny-first practice (`ci-pipeline:c5`): deliberately exceed the budget once in a throwaway tree and prove the gate fails, then restore.

Until Q-Deploy-1 sets a threshold, the size check cannot land — so the interview must not defer the budget to “later Construction.”

**Remote CI (`check.yml`):** Matrix mirroring `bun run check` is correct; “NOT YET VERIFIED” remains true. Local `bun run check` stays the source of truth until a green remote run (Q-Deploy-2). Quality does not block practices affirmation on remote verification, but the first docs-i18n PR should be treated as the acceptance run.

### 5. Test/code patterns for docs-i18n

- **Pyramid:** Unit-heavy on resolver + api-core handlers; few integration smokes across HTTP and postMessage; no new e2e framework.
- **No i18n message library tests** — content-tree switching only; aligns with Forbidden draft and technology-stack (no react-i18next/lingui).
- **Fixtures:** Synthetic `en/` + `ja/` trees under a test fixtures path; never mutate tb-lxp or treat upstream snapshot as unit fixture (tb-lxp policy unchanged / irrelevant for content loader).
- **Performance:** Docs site must not regress NFR-2 first-paint; measurement stays performance-validation with min/p50/p95/max and cold/warm (project Testing Posture learnings). Practices draft should note that size gate ≠ perf gate — both required.
- **Every defect a test:** Locale/path bugs found in Construction get a regression in the locale-resolver or guardPath suite before merge.

### 6. Gaps the human interview must resolve (quality lens)

Already in lead `evidence.md` — endorse as must-answer before Construction:

1. **Q-Test-1** — Affirm 95% branch floor on locale resolver/loader (quality recommends **yes**).
2. **Q-Test-2** — Size check in `bun run check` vs advisory (quality recommends **enforced in check**).
3. **Q-Deploy-1** — Numeric VSIX/media budget (required input to write the gate).

Recommend the lead add or fold into interview:

4. **Q-Test-3 (proposed)** — Must Construction for docs routes include vscode-extension host tests for locale path open-doc + containment (close D8 for this intent), or is dashboard/api-core coverage alone accepted?
5. Confirm Vitest remains the only runner and that new thresholds are expressed in Vitest config (not a second coverage tool).

Style/layout questions (Q-Style-1..3, Q-WoW-1) affect *where* tests point, not the testing posture itself — no quality objection.

## Positions

- AGREE: Vitest retained; no new test framework; synthetic en/ja fixtures for content-loader tests — matches affirmed Testing Posture and keeps suite deterministic.
- AGREE: `bun run check` remains the single quality-gate definition; new docs-i18n checks must wire into that script (ci-pipeline:c2).
- AGREE: Locale resolver is correctly flagged as parse-tier criticality; Q-Test-1 is the right affirmation question.
- AGREE: Extension-host thinness and light api-core suite are the right debt signals for this intent (`code-quality-assessment` D8 + api-core weakness).
- OBJECT: “Aim for 80%” on new api-core docs routes is too soft for a gate — affirm a hard coverage floor (recommend 80% line, with branch attention on error paths) and require multi-host contract coverage of the shared handler.
- OBJECT: Leaving VSIX size as optional/advisory (Q-Test-2 open toward advisory) under-protects D5 — affirm enforced `check:size` inside `bun run check` once Q-Deploy-1 sets a numeric budget; verify deny-first.
- OBJECT (gap): Draft has no interview item forcing vscode-extension locale path / containment tests for this intent — add Q-Test-3 or fold into Testing Posture affirmation so D8 is not deferred past M1/M2.
