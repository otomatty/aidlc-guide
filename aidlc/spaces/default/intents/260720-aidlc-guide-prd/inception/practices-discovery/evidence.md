# Evidence — practices-discovery (AIDLC Guide)

> ステージ: practices-discovery (Inception 2.2) / 作成日: 2026-07-22
> 人間との対話（affirmation gate）完了。最終統合版。

## Inspected — Lead

- `aidlc/spaces/default/memory/org.md` — Way of Working (trunk-based,
  squash-merge), Walking Skeleton, Testing Posture (feature/mvp: 80%
  coverage, tests in CI), Deployment (deploy-on-merge to staging + manual
  prod gate), Code Style (defer to project linter config)
- `aidlc/spaces/default/memory/team.md` — empty baseline (no prior
  affirmations); this stage produces the first draft for the human to affirm
- `aidlc/spaces/default/memory/project.md` — `## Decided` already records
  three learnings from earlier stages: PRD v0.1 treated as approved baseline,
  persona/milestone tie-break rule, and the critical "local-only, no
  cloud/AWS" constraint
- `.claude/scopes/aidlc-prd-implementation.md` — `skeleton: on`, Standard
  depth, "no production deployment," full inception + construction, only
  performance-validation survives in operation phase
- `aidlc/spaces/default/intents/260720-aidlc-guide-prd/ideation/intent-capture/intent-statement.md`
  — read-only principle, local-tool-only principle, M1–M4 full scope
- `aidlc/spaces/default/intents/260720-aidlc-guide-prd/ideation/feasibility/constraint-register.md`
  — C-T1 through C-T7 (technical), C-O1–C-O3 (organizational, already mirror
  org.md), C-R1–C-R2 (regulatory, none apply), scope exclusions

## Inspected — Support contributions

- **aidlc-quality-agent**: assessed Testing Posture through the QA lens.
  Flagged that a flat 80% line-coverage number under-tests the parser (risk
  center) and over-taxes UI tests; that no test runner/coverage tool was
  named (load-bearing because `bun test` lacks branch coverage); and that the
  quality gate needed to enumerate lint/format/typecheck explicitly, not just
  "tests green."
- **aidlc-developer-agent**: assessed Code Style through the structural lens.
  Flagged that the draft covered naming/formatter/cross-platform but omitted
  layer boundaries — reader-core's one-way dependency from the 3 surfaces,
  parser module isolation (NFR-6/C-T3), and the parse-boundary error contract
  (typed Result, no throw). Also objected to "Prettier + ESLint, or `bunfmt`
  if available" as internally inconsistent (`bunfmt` doesn't exist as a
  formal tool; the "if available" condition never resolves on a greenfield
  repo) and proposed Biome as the lazy single-tool default.
- **aidlc-devsecops-agent**: assessed supply-chain and network exposure.
  Confirmed the security surface is genuinely small (C-R1: no PII/regulated
  data) and no SAST platform is warranted. Flagged two gaps: (1) Mob-mode LAN
  exposure rebroadcasts rendered workflow artifacts that may contain
  user-pasted secrets, so `--host` needs a disclosure warning and loopback
  (not `0.0.0.0`) must be the literal default; (2) supply-chain hygiene
  (lockfile pin + `bun audit` in the local gate) should be a hard Mandated
  rule, not left to unenforced repo config.

## Interview decisions (binding, 2026-07-22)

- **Q1 Way of Working**: A — org.md default confirmed as-is (trunk-based +
  Bolt squash-merge to main).
- **Q2 Walking Skeleton**: A — first slice = "read one state file → render
  the Dashboard Now strip (1 screen)," proving the aidlc-reader → Dashboard
  integration minimally.
- **Q3 Testing Posture**: A — runner = Vitest (branch coverage). Parser layer
  = branch-coverage focus + tb-lxp golden/fixture tests; UI layer = ~80% line
  target; Milkdown/WYSIWYG = real-fixture display verification + manual
  visual checklist. Local gate = coverage floor + Biome lint/format +
  `tsc --noEmit`.
- **Q4 Deployment**: A — local-only reframe confirmed (no environments, no
  CD; release = squash-merge to main or a git tag; verification shifts to
  performance-validation NFR-2/NFR-3 instead of a deployed smoke test).
- **Q5 Code Style**: A — formatter/linter = Biome (single tool). Three
  structural conventions locked: reader-core UI/transport-agnostic
  (one-way dependency), State-Version parser isolated in a single swappable
  module (NFR-6/C-T3), parse boundary returns a typed Result (not throw).
- **Q6 Mandated/Forbidden**: A — all proposed rules confirmed: write-boundary
  forbidden except `[Answer]:` lines, no cloud/AWS deps, bun-only runtime/no
  DB; Mob-mode loopback default + `--host` disclosure warning; bun lockfile
  pinned + `bun audit` in the local gate.

## Vitest vs. C-T1 note

C-T1 (NFR-5) mandates bun as the only runtime, with no additional
runtime/process manager. Vitest is added as a **dev-time devDependency**
used to run the test suite during development — it is not a shipped runtime
component of the tool itself and does not run in the tool's production
execution path. This was flagged explicitly at the interview (Q3) precisely
because the distinction (runtime vs. dev tooling) is easy to conflate; the
human confirmed the reframe. No contradiction with C-T1/Forbidden "no
additional runtime" is introduced.

## Residual uncertainty / follow-ups for later stages

- Package/workspace layout for "1 library / 3 surfaces" (single package with
  `src/reader` / `src/mcp` / `src/dashboard` vs. bun workspaces with a
  separate `packages/reader-core`) was raised by aidlc-developer-agent as an
  open layout choice, not resolved by this stage's questions. Defer to
  functional-design / code-generation for the first Bolt (PU-01), applying
  the three locked structural conventions regardless of which layout is
  chosen.
- tb-lxp fixture governance (vendored vs. cloned, and the specific
  commit/snapshot to pin) is flagged by both quality and devsecops
  contributions as needed for deterministic golden tests and perf baselines,
  but the specific commit/pin mechanism is a build-and-test / ci-pipeline
  concern, not resolved here.
- Kebab-case file naming (developer-agent suggestion, TS convention +
  cross-platform filesystem safety) is a light preference, not elevated to a
  Mandated rule — left as project-level guidance for the first Bolt to
  establish by example.
