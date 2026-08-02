# Demo Record — docs-navigation (Bolt 3)

> Manual acceptance for US-B3-06 / C7  
> Surface: VS Code / Cursor extension webview only (NFR-B3-2)

## Preconditions

1. Build / package extension (`bun run build:extension` or equivalent).
2. Open a workspace with an active AI-DLC intent that includes stage **intent-capture** (mapped in STAGE_DOC_MAP).
3. Run **AIDLC Guide: Open**.

## Steps — mapped StageCard → Docs Shell

1. In the dashboard, select stage **intent-capture** so the StageCard is visible.
2. Find the docs control labeled `Docs: Intent Capture` (not bare `Docs`).
3. Activate with pointer (or Tab + Enter/Space).
4. **Expect:** Official Docs Shell opens in the webview (no external browser).
5. **Expect:** LocaleControl reflects last preference or `en`.
6. **Expect:** Body shows `guide/getting-started.md` scrolled to `#approval-gates` when that heading exists.
7. Close Shell; reopen via StageCard again — deep-link still lands (one-shot clear does not break subsequent opens).

## Steps — unmapped StageCard

1. Select a stage **not** in STAGE_DOC_MAP (e.g. `code-generation`).
2. Activate `Docs: Code Generation`.
3. **Expect:** Shell opens at top (TOC / first page path), locale applied, no crash.
4. **Expect:** No `vscode.open` / external browser.

## Locale preference

1. In Shell, switch LocaleControl to `ja`, close Shell.
2. Activate a StageCard docs control again.
3. **Expect:** Payload uses `ja` (Shell lands on `ja` LocaleControl).

## Negative (optional)

1. (Devtools) Post a malformed `{ type: "open-official-doc", locale: "de" }` to the host.
2. **Expect:** No Shell open, locale preference unchanged.
