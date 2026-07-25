**Collaborator:** aidlc-quality-agent

## Contribution

Testing-posture assessment of the lead draft through the QA/testing lens. The draft's overall posture (tests alongside code, green-before-merge, tb-lxp as read-only fixture) is sound. My concern is that a single flat "80% line coverage" number is the wrong shape for this codebase, and that the draft names no test runner or coverage tool — the one decision that most determines whether the parser (the risk center) actually gets verified.

### 1. Is ≥80% line coverage right? Partly. Reshape it.

Line coverage is a blunt aggregate. This tool has two very different halves with opposite testability:

- **Parser / State-Version reader (the risk center):** pure, deterministic, input→model functions. Bugs here silently corrupt everything downstream. Line coverage is *insufficient* here — the danger is in branches: State Version detection, unsupported-version rejection (C-T3), malformed/partial input (C-T5 `--fork-session` last-flush JSONL), and the ~593-file scale. Hold this module to **branch coverage**, not line, plus fixture-driven golden tests and explicit "cannot parse / unsupported" assertions.
- **Milkdown/WYSIWYG + React display (M3):** rendering fidelity is not captured by any coverage number. A component can be 100% line-covered and still render the wrong thing. Chasing 80% line here produces shallow assertions that inflate the aggregate without adding safety.

Recommendation: keep **80% as an aggregate floor** (fine as a guardrail, inherited from org.md feature/mvp), but pair it with a **per-module expectation on the parser** (branch coverage + malformed-input cases) and treat the display layer's contribution as intentionally lower, backed by rendering/integration tests rather than unit coverage. This is a refinement of the org default, not a contradiction of it.

### 2. Coverage tooling for bun + TS + React — unresolved, and it matters

The draft says "CI（ci-pipeline相当のローカルコマンド）" but names no runner. This is the biggest testing gap:

- `bun test` (built-in, aligns with C-T1 "bun only") gives line + function coverage but **no branch coverage** — exactly what the parser needs. It also has weaker React/jsdom component-testing ergonomics.
- **Vitest** shares the Vite config the app already uses, gives branch coverage (v8/istanbul), and has first-class `@testing-library/react` + jsdom support for the M3 display tests. Tension to resolve: C-T1 forbids "additional runtime / DB." A Vitest devDependency is a dev tool, not a shipped runtime — this almost certainly does not violate C-T1, but it must be explicitly confirmed at the interview rather than assumed.

This runner/coverage-tool choice should be decided *now*, because the parser's branch-coverage requirement (item 1) can't be met by `bun test` alone.

### 3. CI quality gate — enumerate it

Since there is no cloud CI and no deploy-on-merge (the deployment reframe is correct), the "gate" is a single local pre-merge command. Spell out its contents so it's a real quality gate, not just "tests pass":

`bun run check` = test suite green + coverage floor met + lint (ESLint) + format check (Prettier) + **typecheck (`tsc --noEmit`)**. Typecheck is a first-class gate for a TS parser project and is currently unmentioned. Optionally wire it to a pre-push git hook since there's no server-side CI to enforce it.

### 4. Test/code patterns fit

- **Parser → unit-heavy, table-driven against real fixtures.** Golden-file tests: parse a pinned tb-lxp snapshot, assert the produced model. Add negative cases: unsupported State Version → explicit rejection (C-T3); truncated/last-flush JSONL → graceful handling, no crash (C-T5). Highest-value test investment in the project.
- **Milkdown/WYSIWYG (M3) → display verification against real fixtures, not coverage.** Render parsed real fixtures through the editor and assert on visible structure via `@testing-library/react`; supplement with a short documented **manual visual checklist** for fidelity that assertions can't capture. Because M3 explicitly allows swapping the editor (C-O3), tests must target the **data contract into the editor**, not Milkdown internals — so an editor swap doesn't invalidate the suite.
- **Cross-platform (C-T4) is a test-environment gap coverage won't catch.** `path.sep` / file-watch / process-spawn bugs pass every unit test on one OS. Require path-handling unit tests using cross-platform APIs *and* a documented dual-run (Windows Git Bash + macOS) before merge, since there's no CI matrix to run both automatically.
- **Security-relevant regression test:** assert the Mob-mode server binds **localhost by default** and exposes on LAN only with the explicit flag (C-T6). This belongs in the gated suite as a standing regression test.
- **Perf fixtures must be pinned.** NFR-2 (startup ≤3s) / NFR-3 (change→reflect ≤2s) are measured at performance-validation, but the tb-lxp fixture must be pinned to a **specific commit/snapshot** so both the parser golden tests and the perf baselines are deterministic and reproducible.

### 5. Gaps the human interview must resolve

1. **Test runner + coverage tool:** `bun test` vs Vitest, given the parser needs branch coverage and M3 needs React component testing. Confirm a Vitest devDependency does not conflict with C-T1.
2. **Coverage metric and shape:** aggregate line floor vs per-module branch expectation on the parser. Confirm the "80%" is an aggregate floor, not a per-file requirement that would force shallow UI tests.
3. **tb-lxp fixture governance:** vendored vs cloned, and pinned to which commit — needed for deterministic parser golden tests *and* stable perf baselines.
4. **WYSIWYG acceptance method:** automated rendering assertions, a manual visual checklist, or both — and confirm tests target the data contract so the M3 editor swap (C-O3) doesn't break the suite.
5. **Every-defect-a-test policy:** confirm the team commits to a regression test per fixed defect (especially parser and cross-platform bugs), since there's no CI safety net beyond the local gate.

## Positions

- AGREE: Tests written alongside code, suite green before merge, tb-lxp treated as an immutable read-only fixture — correct and consistent with the read-only mandate (C-T2).
- AGREE: The deployment reframe (local release = merge/tag, performance-validation as the smoke-test analogue) — not my lens, but it correctly removes the CD assumptions that don't hold here.
- OBJECT (refine, not reject): A single flat 80% line-coverage gate under-tests the parser and over-taxes the UI. Keep 80% as an aggregate floor but add a per-module **branch-coverage** expectation on the parser/State-Version reader with fixture golden tests and malformed-input cases.
- OBJECT: The Testing Posture and Code Style sections name no test runner or coverage tool. This must be resolved at the interview — `bun test`'s lack of branch coverage is disqualifying for the parser, so the choice is load-bearing, not a later detail.
- OBJECT (gap, not error): The quality gate is described only as "tests green in a local command." Enumerate it — coverage floor + lint + format + `tsc --noEmit` typecheck — otherwise typecheck (critical for a TS parser) is silently omitted.
