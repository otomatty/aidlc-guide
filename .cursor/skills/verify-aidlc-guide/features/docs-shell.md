# Official docs

ドキュメント is the in-app reader for aidlc-workflows official pages and AIDLC Guide extension docs. The landing page offers two categories; picking one opens the article shell.

## Sub-features

- `docs-open` replaces home with the docs landing (`ドキュメント` heading, `[data-testid="docs-home"]`).
- `docs-workflow` opens the workflow category via `ワークフローのドキュメントを探す`.
- `docs-extension` opens the extension category via `拡張機能のドキュメントを探す`.
- `docs-article` shows article-specific state after a `docs-toc-*` or `docs-guide-*` pick.
- `docs-close` returns to home.

## How to get to it (user POV)

- Header button `ドキュメント`.
- Narrow viewport: `メニュー` then `ドキュメント`.

## Driving it with the AIDLC Guide harness

Preconditions:

- Doctor is green; browser is 1280×800 on `{origin}`; home is showing (intent dialog dismissed).

- **Open docs.** Click `button` name `ドキュメント` (`header-nav-docs`). `[data-testid="docs-home"]` is present and heading `ドキュメント` is visible. Screenshot `docs-shell-home.png`.
- **Open workflow docs.** Click `ワークフローのドキュメントを探す`. `[data-testid="docs-drawer"]` opens with the ワークフロー tab selected and `[data-testid="docs-toc"]` present. `[data-testid="docs-home"]` stays mounted behind the drawer until an article is selected — do not require it to disappear. Snapshot `docs-shell-workflow.aria.txt`.
- **Open extension docs.** Close the drawer or stay on docs home, then click `拡張機能のドキュメントを探す`. The 拡張機能 tab is selected. Rows are `[data-testid="docs-guide-<name>"]` (for example `docs-guide-README.md`) in a plain nav, not `[data-testid="docs-toc"]`. Snapshot `docs-shell-extension.aria.txt`.
- **Open a workflow article.** The previous step left the drawer on the extension tab; `docs-toc-*` rows live only on the workflow tab. Click the `ワークフロー` tab, then click a TOC row (`docs-toc-<path>`). Wait until that row is `data-active`, `[data-testid="docs-article-h1"]` is non-empty, the Official docs skeleton is gone, and `[data-testid="area-error-docs-shell"]` is absent. Do not require the heading text to equal the TOC label — `overview/release-highlights.md` and `overview/changelog.md` show as `更新のハイライト` / `更新履歴一覧` while h1 is the document title. Home is then gone. The wrapping `[data-testid="docs-article"]` exists on the landing page too — do not treat it as proof. Screenshot `docs-shell-article.png`.
- **Open an extension article.** Selecting a workflow article closes the drawer, so the extension tab is gone. Click `[data-testid="docs-menu"]` to reopen the drawer, click the `拡張機能` tab, then click a `docs-guide-*` row (never `docs-toc-*` on this tab). Wait for the same `docs-article-h1` proof. Screenshot `docs-shell-extension-article.png`.
- **Return home.** Press Escape (drawer first, then the shell) or click `ステージ一覧` (`header-nav-home`). There is no panel close button — `DocsShell` does not pass `closeTestId`. `[data-testid="docs-home"]` and `[data-testid="docs-shell"]` are gone; `ステージ一覧` heading is visible.

## Gotchas

- Docs Q&A (`docs-question-panel`) can spawn Claude/Cursor CLIs. Skip ask/cancel unless the recipe is specifically Q&A; a timeout there is not a docs-reader failure.
- Locale toggle (`locale-control`) switches en/ja. Assert the article heading you opened, not a remembered English title after a toggle.
- Release TOC rows (`overview/release-highlights.md`, `overview/changelog.md`) show aliased Japanese labels. Proof is a non-empty `docs-article-h1` plus the selected row, not identical strings.
- Untranslated pages show `[data-testid="untranslated-notice"]`. That is a valid article state, not a load failure.
- The wrapping `[data-testid="docs-article"]` is mounted on the docs landing page and while a page is loading or has failed. Wait for `[data-testid="docs-article-h1"]` (or report the error region) before calling the article path verified.
- Do not fetch `/api/official-docs/...` instead of clicking `ドキュメント`. The API is a second view after the UI opened the page, not the user path.
