# Effectiveness

効果測定 compares recorded intents on time, waits, and related totals. It is a panel over the dashboard, not a separate server.

## Sub-features

- `effectiveness-open` shows heading `効果測定` and `[data-testid="effectiveness-panel"]`.
- `effectiveness-summary` shows the `比較対象の集計` region (or a typed empty/error state).
- `effectiveness-refresh` reloads via `更新`.
- `effectiveness-close` returns to home.

## How to get to it (user POV)

- Header button `効果測定`.
- Narrow viewport: `メニュー` then `効果測定`.

## Driving it with the AIDLC Guide harness

Preconditions:

- Doctor is green; 1280×800 on `{origin}`; home visible.

- **Open panel.** Click `button` name `効果測定`. `[data-testid="effectiveness-panel"]` exists and accessible heading is `効果測定`. Screenshot `effectiveness-open.png`.
- **Read summary.** Wait until the loading skeleton is gone. Either `[aria-label="比較対象の集計"]` is present, or the panel shows the empty/error copy from the app. Save `GET {origin}/api/effectiveness` as `effectiveness.json`. A 200 body with zero intents is a valid empty proof, not a failure.
- **Refresh.** Click `更新` (`effectiveness-refresh`). The panel stays open; capture a second snapshot.
- **Close.** Dismiss the panel (close control on the shell). Home `ステージ一覧` is visible again.

## Gotchas

- Summary metrics can read `未記録`. That is stored-data emptiness, not a broken panel.
- Filters (`effectiveness-filters`) change which rows are shown. If you apply filters, say so in `PROOF.md`; default proof uses the unfiltered list.
- Do not compare these numbers to `bun run test` coverage. They come from workflow audit timings.
