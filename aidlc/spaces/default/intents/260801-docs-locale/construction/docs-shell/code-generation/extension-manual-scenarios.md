# Extension manual scenarios — docs-shell (FR-B2-5.2)

> code-generation / docs-shell (ui) / 2026-08-02  
> Host: vscode-extension Webview (NFR-B2-3). Screenshots optional.  
> Automated coverage: dashboard `docs-shell.test.tsx` (keep-path / notice / 404 / AnchorApplier). This checklist is the **extension surface** acceptance record.

## Preconditions

- [ ] Workspace has official docs content under the aidlc-workflows capture path used by the host
- [ ] Extension (or dashboard Webview) can open Official Docs shell
- [ ] Both `en` and `ja` locales available; at least one path missing from ja TOC or untranslated (sparse-ja / `missing_ja`)

## Scenario A — keep-path (FR-B2-1.1 / 1.3)

1. Open Official Docs; select a path present in **both** en and ja TOCs (e.g. a shared guide page).
2. Switch LocaleControl **en → ja** (and back).
3. **Expect:** same `path` remains loaded; TOC highlight stays on that entry when it exists in the new TOC; LocaleControl `aria-current` follows the requested locale.
4. Select a path that exists in **en** but is **absent from ja TOC** (sparse-ja), then switch to **ja**.
5. **Expect:** path is **kept** (does not jump to TOC first entry); ja TOC shows **no** highlight for the missing entry; body still requests that path (may show `missing_ja` notice or content per wire).

- [ ] Pass — keep-path en↔ja (shared path)
- [ ] Pass — keep-path sparse-ja (path absent from ja TOC)
- [ ] Notes / date: ________________________________

## Scenario B — missing_ja notice (FR-B2-2)

1. From Official Docs, select a page that is untranslated for ja (`notice: "missing_ja"` on the wire).
2. Switch LocaleControl to **ja**.
3. **Expect:** UntranslatedNotice visible with `role="status"`; English (or served) body still readable; LocaleControl remains on **ja** (`aria-current`), not flipped to en.
4. Switch back to **en**.
5. **Expect:** notice disappears; locale control on en.

- [ ] Pass — notice + role=status while locale stays ja
- [ ] Notes / date: ________________________________

## Scenario C — missing-anchor → top (FR-B2-3)

1. Open a docs page with a deep-link / requested `#anchor` that **does not** match any heading (host may pass `?anchor=` or equivalent).
2. **Expect:** `anchorApplied="top"` behavior — view scrolls/focuses **page/article top**, not a wrong heading; locale control unchanged.
3. Open a page with a **valid** heading anchor.
4. **Expect:** `anchorApplied="scrolled"` — matching heading scrolled/focused.
5. Open with **no** anchor.
6. **Expect:** `anchorApplied="none"` — no forced scroll jump.

- [ ] Pass — missing anchor → top
- [ ] Pass — valid anchor → scrolled
- [ ] Pass — no anchor → none
- [ ] Notes / date: ________________________________

## Scenario D — 404 ≠ notice (ADR-B2-001)

1. Force a missing page (invalid path or deleted doc) so the page fetch errors (`not_found` / AreaError).
2. **Expect:** error UI only; **no** UntranslatedNotice.

- [ ] Pass — error without notice
- [ ] Notes / date: ________________________________

## Sign-off

| Field | Value |
|-------|-------|
| Executor | |
| Date | |
| Host (Cursor / VS Code build) | |
| Result (all Pass / partial) | |
| Link to PR / commit (optional) | |
