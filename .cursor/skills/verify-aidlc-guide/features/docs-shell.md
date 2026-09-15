# Official docs

ドキュメント is the in-app reader for aidlc-workflows official pages and AIDLC Guide extension docs. The landing page offers two categories; picking one opens the article shell.

## Sub-features

- `docs-open` replaces home with the docs landing (`ドキュメント` heading, `[data-testid="docs-home"]`).
- `docs-workflow` opens the workflow category via `ワークフローのドキュメントを探す`.
- `docs-extension` opens the extension category via `拡張機能のドキュメントを探す`.
- `docs-article` shows `[data-testid="docs-article"]` after a TOC pick.
- `docs-close` returns to home.

## How to get to it (user POV)

- Header button `ドキュメント`.
- Narrow viewport: `メニュー` then `ドキュメント`.

## Driving it with the AIDLC Guide harness

Preconditions:

- Doctor is green; browser is 1280×800 on `{origin}`; home is showing (intent dialog dismissed).

- **Open docs.** Click `button` name `ドキュメント` (`header-nav-docs`). `[data-testid="docs-home"]` is present and heading `ドキュメント` is visible. Screenshot `docs-shell-home.png`.
- **Open workflow docs.** Click `ワークフローのドキュメントを探す`. `[data-testid="docs-home"]` is gone. `[data-testid="docs-toc"]` is present. Snapshot `docs-shell-workflow.aria.txt`.
- **Open extension docs.** Return to docs home if needed (`ドキュメント` again or the docs menu), then click `拡張機能のドキュメントを探す`. `[data-testid="docs-toc"]` lists extension guides (`docs-guide-*` or the extension TOC). Snapshot `docs-shell-extension.aria.txt`.
- **Open an article.** Click a TOC row (`docs-toc-<path>`). Wait until `[data-testid="docs-article-h1"]` has a non-empty title matching that row, the Official docs skeleton is gone, and `[data-testid="area-error-docs-shell"]` is absent. The wrapping `[data-testid="docs-article"]` exists on the landing page too — do not treat it as proof. Screenshot `docs-shell-article.png`.
- **Return home.** Close the docs shell (panel close) or click `ステージ一覧`. `[data-testid="docs-home"]` and `[data-testid="docs-shell"]` are gone; `ステージ一覧` heading is visible.

## Gotchas

- Docs Q&A (`docs-question-panel`) can spawn Claude/Cursor CLIs. Skip ask/cancel unless the recipe is specifically Q&A; a timeout there is not a docs-reader failure.
- Locale toggle (`locale-control`) switches en/ja. Assert the article heading you opened, not a remembered English title after a toggle.
- Untranslated pages show `[data-testid="untranslated-notice"]`. That is a valid article state, not a load failure.
- The wrapping `[data-testid="docs-article"]` is mounted on the docs landing page and while a page is loading or has failed. Wait for `[data-testid="docs-article-h1"]` (or report the error region) before calling the article path verified.
- Do not fetch `/api/official-docs/...` instead of clicking `ドキュメント`. The API is a second view after the UI opened the page, not the user path.
