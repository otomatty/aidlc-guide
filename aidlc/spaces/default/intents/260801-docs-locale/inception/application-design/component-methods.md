# Component Methods — Docs i18n Bolt 2

> ステージ: application-design / 2026-08-01  
> 上流: [components.md](./components.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md) · [architecture.md](../../../codekb/aidlc-guide/architecture.md) · [component-inventory.md](../../../codekb/aidlc-guide/component-inventory.md)  
> 詳細ビジネスルールは Functional Design。ここは Bolt 2 で固定する公開面。

## Error / result kinds (unchanged shape)

| Kind | Meaning |
|------|---------|
| `ok` | Page / TOC loaded |
| `not_found` | Path unknown in **en** tree (or both) |
| `missing_ja` | Requested ja; serve en body + `notice` (success-shaped page) |
| `path_rejected` | `guardPath` failed |
| `empty_content` | Manifest / snapshot missing |

---

## `@aidlc-guide/official-docs` (Bolt 2 contracts)

### `resolvePage(input) → Result<ResolvedPage>`

```text
input: { workspaceRoot, locale: "en"|"ja", path: string, anchor?: string }
ResolvedPage → OfficialDocsPage fields:
  localeRequested, localeServed, path, bodyMarkdown,
  notice?: "missing_ja", sourceVersion,
  anchorApplied: "scrolled" | "top" | "none"
```

| Rule | Behavior |
|------|----------|
| Keep-path | 常に要求 `path` を返す。対象 locale ファイル欠落でも path を別 path に書き換えない（FR-B2-1.1） |
| missing_ja | `locale=ja` かつ ja 無し → `localeServed=en`, `notice="missing_ja"`, en body |
| anchor | 見出しあり → `scrolled`；無し → `top`；anchor 無し → `none` |
| Containment | locale root + `guardPath` |

### `listToc(workspaceRoot, locale) → Result<OfficialDocsToc>`

- Returns locale TOC tree (`OfficialDocsToc` / nodes with `path`)
- Used by Docs Shell after locale switch to decide TOC highlight (FR-B2-1.2 / FR-B2-1.3)
- **Highlight rule (UI):** if any TOC node `path ===` current page `path` → select it; else no TOC selection (body path still from `resolvePage`)

### Coverage floor (NFR-B2-1 / Q5=A)

Modules under `bun run check` branch coverage **≥ 95%**:

- `packages/official-docs/src/resolve.ts`
- `packages/official-docs/src/roots.ts`
- `packages/official-docs/src/markdown.ts`

---

## `@aidlc-guide/api-core`

### `handleOfficialDocsGet` (pass-through + errors)

- Success (`ok` including success-shaped `missing_ja` page): HTTP **200** + `OfficialDocsPage` JSON  
  Map fields **without** renaming or inventing notice/anchor (FR-B2-4). Never derive `missing_ja` from status codes.
- TOC: `GET /api/official-docs/toc/:locale` → `listToc` → **200** + `OfficialDocsToc` (or error table below)

| Result kind | HTTP | Body | Dashboard behaviour |
|-------------|------|------|---------------------|
| `ok` / success `missing_ja` page | 200 | `OfficialDocsPage` | Render body; notice iff `notice==="missing_ja"` |
| `not_found` | 404 | error envelope (not OfficialDocsPage) | Existing Shell **not_found** state — do **not** show missing_ja banner |
| `path_rejected` | 400 | error envelope | Show path-rejected / safe error; no notice banner |
| `empty_content` | 503 or 404 (pick one in FD; default **503**) | error envelope | Empty/unavailable state; no notice banner |

**Invariant (ADR-B2-001):** `missing_ja` is only ever a **200** `OfficialDocsPage` with `notice`. HTTP 404 must never be interpreted as untranslated.

---

## `@aidlc-guide/dashboard` (Docs Shell)

| Action | Purpose |
|--------|---------|
| `setLocale(locale)` | Switch en↔ja; keep displaying response `path` |
| `renderNotice(page)` | Show banner iff `page.notice === "missing_ja"`; `role="status"` |
| `applyAnchor(page)` | `scrolled` → heading focus/scroll; `top` → h1/main top; `none` → no forced jump |
| `syncLocaleControl(page)` | Control shows `localeRequested`, never dragged to `localeServed` |
| `syncTocHighlight(toc, path)` | Highlight TOC node matching `path` if present; else clear selection (FR-B2-1.2/1.3) |
| `renderFetchError(kind)` | Map 404/400/503 to not_found / rejected / empty — never to missing_ja |

---

## `@aidlc-guide/shared-types`

- Keep `OfficialDocsPage` / `OfficialDocsPageNotice = "missing_ja"` / `OfficialDocsToc` field names (FR-B2-4.3)
- No Bolt 2 additive required fields on `OfficialDocsPage` beyond existing interface (TOC stays separate resource)

---

## Review

**Verdict:** READY — see full review in [components.md § Review](./components.md#review).

F1 closed: `listToc` signature, dashboard `syncTocHighlight`, and highlight rule are present and consistent. F2 closed: HTTP error table with all non-ok Result kinds and dashboard rendering actions explicitly specified; 404 ≠ missing_ja invariant written. No new structural issues introduced.

---

## Story → method map

| Story | Primary methods |
|-------|-----------------|
| US-B2-01 | `resolvePage` + `listToc` + `setLocale` + `applyAnchor` + `syncTocHighlight` |
| US-B2-02 | `resolvePage` (missing_ja) + `renderNotice` + wire assert |
| US-B2-03 | coverage on resolve/roots/markdown + extension manual scenarios |
| US-B2-S1 | body title as `h1` (Should) |

