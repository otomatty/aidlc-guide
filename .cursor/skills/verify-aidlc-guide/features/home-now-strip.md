# Home and current stage

Home is the first screen after the dashboard loads: the Now strip names the current stage (or a typed empty state) and the stage list heading `ステージ一覧` sits above the rail.

## Sub-features

- `home-paint` shows `app-shell` and the `ステージ一覧` heading.
- `now-current` shows `現在のステージ：` plus the current slug, `ワークフロー完了`, or `現在のステージなし`.
- `now-expand` reveals phase, scope, and done counts.
- `rail-list` lists stages as `stage-rail-item-<slug>` rows when a workflow parsed.

## How to get to it (user POV)

- Open the dashboard URL the harness printed.
- From any other Dashboard page, choose header `ステージ一覧`.
- On a narrow viewport, open `メニュー` then `ステージ一覧`.

## Driving it with the AIDLC Guide harness

Preconditions:

- `harness.ts doctor` is green.
- Browser is 1280×800 on `{origin}`.
- If `インテント一覧` is open, choose one intent so home is not covered, or close the dialog and note that Now strip may show empty until a pin exists. `GET /api/workflow` returning `{ error: true, reason: "no-selected-intent" }` is the matching API state, not a failed launch.

- **Confirm chrome.** After load, `[data-testid="app-shell"]` exists and a heading `ステージ一覧` is visible. Screenshot `home-now-strip-paint.png`.
- **Unselected intent.** If `GET {origin}/api/workflow` is `{ error: true, reason: "no-selected-intent" }` (or the dialog was closed without a pin), do **not** look for `[data-testid="now-current-stage"]` or `[data-testid="now-toggle"]`. Proof is the empty title `インテントを選んでください` plus the saved JSON. Then pin an intent from `インテント一覧` and wait until the dialog closes before the next bullets.
- **Read current stage.** After a pin, find `[data-testid="now-current-stage"]`. Save `GET {origin}/api/workflow` as `home-now-strip-workflow.json`. If `workflow.currentStage` is a non-null slug, the strip text must equal that slug. If it is `null`, the strip shows `ワークフロー完了` when `total > 0` and `done >= total`, otherwise `現在のステージなし` — do not require the JSON `null` to equal the Japanese copy.
- **Expand Now strip.** Click `[data-testid="now-toggle"]`. `[data-testid="now-scope"]` and `[data-testid="done-total"]` appear. ARIA snapshot to `home-now-strip-expanded.aria.txt`.
- **Scan the rail.** A `stage-rail-item-*` node exists for at least the current stage when `workflow` parsed. If the payload is still a typed error, the rail empty/error state is the proof — do not invent rows.
- **Home from elsewhere.** Open `ドキュメント`, then click `ステージ一覧`. `[data-testid="docs-home"]` is gone and the stage list heading is visible again.

## Gotchas

- Viewport under 48rem hides `header-nav-*`. Use `header-menu-trigger` (`メニュー`) or set the viewport to 1280×800 (`Emulation.setDeviceMetricsOverride`). Cursor's embedded browser often starts narrow.
- Intent dialog can sit on top of home on first paint. Closing it without selecting may leave Now strip empty even when `aidlc-state.md` exists on disk — the dashboard view pin is not the gitignored `active-intent` cursor. The dialog also has `効果測定を見る`. Intent rows disable while `select-intent` is in flight; wait until the dialog closes.
- `now-current-stage` showing `ワークフロー完了` is success for a finished intent, not a missing strip. A completed current stage still shows its slug (for example `performance-validation`) with a completed chip.
- Do not treat `bun test` in `packages/dashboard` as this feature's proof.
