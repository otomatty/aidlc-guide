# Stage Diary — build-and-test

## Interpretations

- 2026-08-02T01:40:00Z — Standard strategy: unit + integration executed; performance N/A; security = path/boundary + audit path.
- 2026-08-02T01:40:00Z — Bolt 2 DoD judged on node coverage floors + docs-shell suite, not full-repo check, because timings.test.tsx fails in isolation.

## Deviations

- 2026-08-02T01:40:00Z — Did not “fix” timings.test.tsx (2-attempt budget would be scope creep / unrelated); documented as outstanding.

## Tradeoffs

- 2026-08-02T01:40:00Z — Removed vitest `coverage.all` after it broke root `tsc` typings; floors still enforced on full `--project node` run (roots/markdown/resolve attributed in coverage-summary.json).

## Open questions

- (none)
