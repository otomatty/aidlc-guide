# Stage detail

Choosing a stage from the rail opens that stage's card: purpose, artifacts, and agent links for the selected slug.

## Sub-features

- `rail-open` opens `[data-testid="stage-card-<slug>"]` from a rail row.
- `detail-nav` moves with previous/next stage controls when they exist.
- `detail-close` returns to the list without a selected card.

## How to get to it (user POV)

- Click a row in the stage rail on home (`stage-rail-item-<slug>`).
- After a card is open, `panel-prev-stage` / `panel-next-stage` move between stages.
- `panel-back` returns toward the list.

## Driving it with the AIDLC Guide harness

Preconditions:

- Doctor is green; workflow JSON contains a `workflow` object with `total > 0`. If `/api/workflow` is a typed error, skip this feature and report `no-parsed-workflow`.
- 1280×800 on `{origin}`; home visible; Now strip not covering the rail.

- **Open current stage.** Read `[data-testid="now-current-stage"]`. If it is a slug (not `ワークフロー完了` / `現在のステージなし`), click `[data-testid="stage-rail-item-<that-slug>"]`. `[data-testid="stage-card-<that-slug>"]` appears. Screenshot `stage-detail-card.png`.
- **If completed.** When Now strip says `ワークフロー完了`, click any `stage-rail-item-*`. The matching `stage-card-*` still opens. Record the slug in `PROOF.md`.
- **Previous / next.** Note the open card's slug. Click `[data-testid="panel-next-stage"]` if it is enabled (`aria-label` is not `次のステージはありません`); the `stage-card-*` testid changes to the next slug. Then click `[data-testid="panel-prev-stage"]` and land back on the starting slug. If both controls are disabled, record that in `PROOF.md` — it is a one-stage workflow, not a failed nav.
- **Close.** Click `[data-testid="panel-back"]` (or the panel close). The card is gone; `ステージ一覧` is visible.

## Gotchas

- Opening a cell on the unit/stage matrix is a different entry (`UnitStageMatrix`). This feature's proof is the rail. If you only click the matrix, say so; do not count it as `rail-open`.
- Artifact viewer / Answer editor inside the card can write `[Answer]:` lines. Read-only open is fine; do not submit answers.
- Slugs are the stage ids from the workflow (for example `performance-validation`), not the Japanese labels.
