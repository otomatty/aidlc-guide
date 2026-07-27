# Codex PR #4 P2 fixes — report

## Addendum — Finding 2 follow-up (coordinator review)

After the initial commit, the coordinator flagged that my `in-progress`/`revising`
denylist comment made a false claim and left a hole. Both held up on inspection.

**The false claim.** My comment said `awaiting-approval` was a status "where the run
has already closed but the gate hasn't been approved yet." I checked the real audit
log's event ordering directly:

```
$ grep -B1 -A1 "STAGE_AWAITING_APPROVAL\|GATE_APPROVED\|STAGE_COMPLETED" \
    aidlc/spaces/default/intents/260720-aidlc-guide-prd/audit/*.md
...
**Timestamp**: 2026-07-20T15:09:11Z   **Event**: STAGE_AWAITING_APPROVAL   Stage: intent-capture
**Timestamp**: 2026-07-20T15:10:48Z   **Event**: GATE_APPROVED             Stage: intent-capture
**Timestamp**: 2026-07-20T15:10:48Z   **Event**: STAGE_COMPLETED           Stage: intent-capture
```

Confirmed across every stage in the real log: `STAGE_COMPLETED` shares a timestamp with
`GATE_APPROVED` and always follows it. So during `awaiting-approval` the run is still
**open** — my comment had the lifecycle backwards.

**The hole.** A stage that completed, was rejected at its gate, went to `revising`, was
redone, and is now back at `awaiting-approval` has an older closed run and a current open
one — and `awaiting-approval` was on the denylist's "safe to show an actual" side. Same bug,
reached through a different status.

### What changed

`packages/dashboard/src/components/StageRail.tsx` — replaced the status-based denylist
with a data-derived one, per the coordinator's suggestion: build a `runningStages` set from
`timings.timings` entries with `endedAt === null`, and exclude any stage in that set from
`actualByStage` regardless of its `StageInfo.status`. `durationOf` no longer needs
`StageInfo` at all — reverted the call site back to `durationOf(stage.slug)`, since the
only reason it took the full `StageInfo` was the now-removed status check.

```ts
const runningStages = new Set(
  (timings?.timings ?? []).filter((t) => t.endedAt === null).map((t) => t.stage),
);
const actualByStage = new Map(
  (timings?.timings ?? [])
    .filter((t) => t.endedAt !== null && !runningStages.has(t.stage))
    .map((t) => [t.stage, t.activeMs] as const),
);
```

### Test — RED then GREEN for the new awaiting-approval case

Added a second `packages/dashboard/tests/timings.test.tsx` case,
`"does not show a previous attempt's closed-run duration as the actual while the stage is
awaiting-approval again"`, reusing the same `reEntryTimings` fixture (closed 2h00m run +
open 5m run for `code-generation`) but with `StageInfo.status: "awaiting-approval"` instead
of `"in-progress"`.

RED (checked out the just-committed denylist version of `StageRail.tsx` via
`git show 145db2f:...StageRail.tsx`, ran only the new test):

```
$ bun run vitest run packages/dashboard/tests/timings.test.tsx -t "awaiting-approval again"
 × does not show a previous attempt's closed-run duration as the actual while the stage is awaiting-approval again
AssertionError: expected '2h00m' not to be '2h00m' // Object.is equality
 ❯ packages/dashboard/tests/timings.test.tsx:268:33
 Test Files  1 failed (1)
      Tests  1 failed | 21 skipped (22)
```

Confirms the denylist version rendered the stale previous-attempt duration for the
`awaiting-approval` re-entry case, exactly as the coordinator predicted.

GREEN (data-derived fix restored):

```
$ bun run test -- timings.test.tsx
 Test Files  1 passed (1)
      Tests  22 passed (22)

$ bun run test -- components.test.tsx
 Test Files  1 passed (1)
      Tests  27 passed (27)
```

Both original precedence tests (`"shows the actual..."` / `"shows the estimate..."`) and
both re-entry tests (`in-progress` and `awaiting-approval`) pass. The original
`"measured AND pending"` precedence fixture (`stageRailTimings`) has no open run for
`code-generation` at all, so `runningStages` is empty there and nothing is excluded —
unchanged behaviour, verified by the test passing rather than assumed.

### Full re-verification

- `bun run check`: **exit code 0** (biome + `tsc --noEmit` ×3 + `vitest run --coverage` +
  `bun audit`; audit: "No vulnerabilities found").
- `git status --porcelain aidlc/`: still only the pre-existing untracked shard
  `aidlc/spaces/default/intents/260720-aidlc-guide-prd/audit/saedgewell-142cdb1f3035.md`.
- Files changed in this addendum: `packages/dashboard/src/components/StageRail.tsx`,
  `packages/dashboard/tests/timings.test.tsx`.

---

## Finding 1 — isolated single-stage runs corrupt the main workflow's timeline

Confirmed real against `.claude/tools/aidlc-orchestrate.ts`:
- `:3405` `syntheticWorkflowId(slug)` returns `single-stage:<slug>`.
- `:3410-3421` a `--single` stage-runner run emits a real `STAGE_STARTED`/`STAGE_COMPLETED`
  pair to `audit.md`, both carrying `**Workflow**: single-stage:<slug>`.
- `:2941-2944` the engine's own report-floor logic skips exactly this tag:
  `auditBlockField(event.block, "Workflow")?.startsWith("single-stage:")`.
- `:2553-2558` comment: a single-stage run is "deliberately ISOLATED from any main workflow".

### What changed

- `packages/shared-types/src/index.ts` — added `workflow: string | null` to `AuditEvent`,
  with a doc comment explaining why it earns a place among the "only the fields the model
  needs are kept" set (BR-RC-6): `derive.ts` needs it to recognise and exclude the
  synthetic single-stage pair.
- `packages/reader-core/src/audit/events.ts` — extracts `Workflow` via the same
  `fieldOf(block, "Workflow")` helper already used for `Stage`, pushed into every
  `AuditEvent`. `readAuditEvents`/`readAllAuditEvents` behaviour (ordering, limit
  semantics, warnings) is unchanged — this only adds a field to the returned objects.
- `packages/reader-core/src/timing/derive.ts` — `deriveStageTimings` now skips any event
  whose `workflow` starts with `single-stage:` **before** any pairing logic runs (first
  line inside the sorted `for` loop), mirroring the engine's own predicate exactly.

### Residual-limitation comment (exact wording, in `derive.ts`)

> Residual limitation: only the lifecycle pair itself carries `Workflow`. Other audit
> events a concurrent single-stage run emits (artifact writes, sensor fires) do not, so
> if one runs while a main-workflow stage is open, those events still land inside that
> stage's window and inflate its `activeMs`. That's a bounded inaccuracy in a time
> estimate — the human genuinely was doing something in that window — not the total loss
> of a run that skipping the lifecycle pair prevents.

### Tests — RED then GREEN

**`packages/reader-core/tests/timing-derive.test.ts`** — new test
`"ignores a synthetic single-stage pair interleaved inside an open main-workflow run"`.
Extended the `events()` helper with an optional 4th `workflow` tuple element (default
`null`), backward-compatible with every existing call site.

RED (temporarily removed the `if (event.workflow?.startsWith(...)) continue;` line and
ran only the new test):

```
$ bun run vitest run packages/reader-core/tests/timing-derive.test.ts -t "ignores a synthetic single-stage"
 × ignores a synthetic single-stage pair interleaved inside an open main-workflow run
AssertionError: expected [ …(2) ] to deeply equal []
- []
+ [
+   "stage run abandoned without completion: alpha",
+   "STAGE_COMPLETED without STAGE_STARTED: alpha",
+ ]
 Test Files  1 failed (1)
      Tests  1 failed | 13 skipped (14)
```

This is exactly the corruption the finding describes: the synthetic `beta` `STAGE_STARTED`
abandons the open `alpha` run, and the real `alpha` `STAGE_COMPLETED` then arrives with no
open run to close.

GREEN (fix restored): full `packages/reader-core` suite — 15 files, 184 passed, 1 skipped.

**`packages/reader-core/tests/audit.test.ts`** — added
`"extracts the Workflow field when present, distinguishing an isolated single-stage run"`,
backed by a new fixture line in `packages/reader-core/tests/fixtures/record/audit/aaa-clone.md`
(`**Workflow**: single-stage:demo-stage` added to the existing `WORKFLOW_STARTED` block, with
a comment explaining it's fixture-only field-extraction bait, not a realistic engine record —
placed on `WORKFLOW_STARTED` rather than the fixture's `STAGE_STARTED` specifically so it stays
inert against `timing-read.test.ts`'s pairing assertions over the same fixture, since it fires
before any run is open). Also updated the pre-existing
`"extracts only Event, Stage and Timestamp"` test to include `workflow: null` — required by the
new mandatory field, not a behavioural change.

Mechanical follow-on (required for `tsc` to pass, not new test coverage): added
`workflow: null` to the handful of other places in the test suite that construct `AuditEvent`
object literals directly — `packages/dashboard-server/tests/push.test.ts`,
`packages/dashboard/tests/reducer.test.ts`, and two more literals inside
`timing-derive.test.ts` itself (the "unparseable timestamp" cases, which don't go through the
`events()` helper).

## Finding 2 — a previous attempt shown as the current run's actual

Confirmed real against `packages/dashboard/src/components/StageRail.tsx:150-165`.
`actualByStage` is built from `timings.filter(t => t.endedAt !== null)`, keyed only by
`stage` — so a re-entered stage (new `STAGE_STARTED` after an earlier closed run) has both
a closed run (the old attempt) and an open run (the current one), and the map keeps the
closed one. `durationOf` had no way to tell the two apart.

### What changed

`durationOf` now takes the row's `StageInfo` instead of the bare slug, and only trusts
`actualByStage` when the row's own `status` says no run is genuinely open right now:

```ts
const running = stage.status === "in-progress" || stage.status === "revising";
const actual = running ? undefined : actualByStage.get(stage.slug);
```

**Deviation from the literal fix wording, and why.** The finding's suggested predicate —
"treat `completed` and `skipped` as finished, everything else falls through" — does not
hold against this codebase's own fixtures: `packages/dashboard/tests/fixtures.ts`'s default
`workflow()` gives `code-generation` status `"awaiting-approval"` (gate open, stage's work
already finished and its `STAGE_COMPLETED` already fired), and the existing
`"shows the actual, with no ≈ and no 推定, for a stage measured AND pending"` precedence
test asserts an actual **does** render for exactly that stage/status combination. A
`completed`/`skipped`-only allowlist would have broken that passing test. `[R] revising
(user rejected gate)` (see `packages/reader-core/tests/fixtures/golden/aidlc-state.md:46`)
is the other genuinely-reopened state — the gate rejected the stage and the human is
redoing the work — so it belongs in the same "a run might really be open" bucket as
`in-progress`. I used a denylist of the two statuses where a run can legitimately be
currently open (`in-progress`, `revising`) instead of an allowlist of finished statuses;
this satisfies the fixed bug (Finding 2's own repro is an `in-progress` re-entry) and keeps
every existing status combination — including `awaiting-approval` — behaving as before.

Call site: `duration={durationOf(stage)}` (was `durationOf(stage.slug)`).

### Tests — RED then GREEN

**`packages/dashboard/tests/timings.test.tsx`** — new test
`"does not show a previous attempt's closed-run duration as the actual while the stage is
in-progress again"`. Fixture: `code-generation` has a closed run at 2h00m (deliberately the
same value as the existing precedence test's actual, so a regression would render the
identical wrong string) and an open run at 5m, workflow status `"in-progress"`, plus a
pending estimate of 5m.

RED (temporarily reverted `durationOf` to the old slug-only, no-status-guard version):

```
$ bun run vitest run packages/dashboard/tests/timings.test.tsx -t "re-entry"
 × does not show a previous attempt's closed-run duration as the actual while the stage is in-progress again
AssertionError: expected '2h00m' not to be '2h00m' // Object.is equality
```

Confirms the row rendered the previous attempt's closed-run duration as an unmarked
actual while the current run was still open — exactly the bug.

GREEN (fix restored): `packages/dashboard/tests/timings.test.tsx` — 21 passed, including
both original `"StageRail duration precedence (actual over estimate)"` tests unmodified
and green:
- `"shows the actual, with no ≈ and no 推定, for a stage measured AND pending"` — passes:
  `code-generation` has status `"awaiting-approval"` (not `in-progress`/`revising`), so the
  new guard doesn't touch it; actual still wins.
- `"shows the estimate with both the ≈ symbol and the 推定 text for a stage with no
  actual"` — passes unchanged (`build-and-test` never had a closed run in the first place).

**Why the normal in-progress case is unaffected.** A stage that is in-progress and has
*never* been re-entered has an open run and no closed run for that slug, so
`actualByStage.get(stage.slug)` was already `undefined` before this change (the
`t.endedAt !== null` filter already excludes the open run). The new `running` guard changes
nothing for that case — it only forces `undefined` in the specific case where a closed run
*does* exist for an in-progress/revising slug, i.e. only the re-entry case. Verified by the
full existing suite staying green (no other test's rendered duration changed).

## Full verification

- `bun run vitest run` (whole repo): 67 files passed, 921 passed, 2 skipped.
- `bun run check` (biome + `tsc --noEmit` ×3 + `vitest run --coverage` + `bun audit`):
  **exit code 0**. `bun audit`: "No vulnerabilities found".
- `git status --porcelain aidlc/`:
  ```
  ?? aidlc/spaces/default/intents/260720-aidlc-guide-prd/audit/saedgewell-142cdb1f3035.md
  ```
  This is the pre-existing per-session audit shard noted as expected in the task brief —
  not written by this work (confirmed: it was present in `git status` before any edits in
  this session, and nothing in either fix touches `aidlc/`). Nothing else under `aidlc/`
  changed.
- Nothing under `.claude/` was modified.

## Files changed

Finding 1:
- `packages/shared-types/src/index.ts`
- `packages/reader-core/src/audit/events.ts`
- `packages/reader-core/src/timing/derive.ts`
- `packages/reader-core/tests/audit.test.ts`
- `packages/reader-core/tests/timing-derive.test.ts`
- `packages/reader-core/tests/fixtures/record/audit/aaa-clone.md`
- `packages/dashboard-server/tests/push.test.ts` (mechanical: new required field)
- `packages/dashboard/tests/reducer.test.ts` (mechanical: new required field)

Finding 2:
- `packages/dashboard/src/components/StageRail.tsx`
- `packages/dashboard/tests/timings.test.tsx`
