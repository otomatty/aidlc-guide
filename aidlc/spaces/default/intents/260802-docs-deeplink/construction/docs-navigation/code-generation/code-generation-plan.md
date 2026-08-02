# Code Generation Plan — Unit: docs-navigation (Bolt 3)

> code-generation / docs-navigation (ui) / 2026-08-02  
> Intent: `260802-docs-deeplink` · Issue #29  
> Test strategy: **Standard** (unit tests per component + boundary checks; demo manual)  
> 上流: BLM · frontend-components · NFR/security design · deployment-architecture · requirements · unit-of-work

## Story → steps

| Story | Steps |
|-------|-------|
| US-B3-01 | 1–4, 7–8 |
| US-B3-02 | 5, 8 |
| US-B3-03 | 1–5, 7–8 |
| US-B3-04 | 9 (map lock — reuse existing stage-map tests; no map edits) |
| US-B3-05 | 5, 8 |
| US-B3-06 | 8–10 |

---

## Steps

### Step 1: Payload types (shared-types) — US-B3-01/03

- [x] Add `OpenOfficialDocMessage` / payload types:
  - Mapped: `{ type: "open-official-doc"; locale: "en"|"ja"; path: string; anchor?: string }` (`path` len ≥ 1)
  - Unmapped: `{ type: "open-official-doc"; locale: "en"|"ja" }` — **omit** `path`/`anchor` keys
- [x] Export from package index
- [x] No dashboard → `@aidlc-guide/official-docs` import

### Step 2: Host handler + locale preference (vscode-extension) — US-B3-01

- [x] `handleOpenOfficialDoc` in `dashboard-panel.ts` (or small helper module)
- [x] Validate: `locale ∈ {en,ja}`; if `path` present must be non-empty string; else treat as unmapped
- [x] On fail: **ignore** (no persist, no Shell open) — BLM F3
- [x] Persist locale to `ExtensionContext.globalState` (key e.g. `aidlcGuide.officialDocsLocale`)
- [x] `getLastOfficialDocsLocale(context)` → `"en"|"ja"` (corrupt → `"en"`)
- [x] On success: postMessage to webview to open Docs Shell + inject deep-link `{ locale, path?, anchor? }`
- [x] Must not call `vscode.open` / external browser on this path

### Step 3: Webview inject seam (dashboard transport + store) — US-B3-01/03

- [x] Listen for host inject message (e.g. `{ type: "docs-shell-deeplink", locale, path?, anchor? }`)
- [x] Extend `docs-shell` action / `docsShellDeepLink` to **require** `locale` when non-null: `{ locale: "en"|"ja"; path?: string; anchor?: string } | null`
- [x] Unmapped inject: `{ locale }` only (open shell, top — no path)
- [x] Update `docsShellRoute` accordingly

### Step 4: DocsShell one-shot locale apply — US-B3-01/03

- [x] On `docsShellDeepLink` consume: set LocaleControl locale from `deepLink.locale` before/with path+anchor apply
- [x] Keep one-shot clear (existing AnchorApplier / deep-link clear behavior)
- [x] Focus rules unchanged (scrolled→heading; top→h1/main)

### Step 5: OpenOfficialDocLink + StageCard wire — US-B3-02/03/05

- [x] Add `openOfficialDocInIde` (or equivalent) in `services/docs.ts` — posts `open-official-doc`
- [x] Fetch `GET /api/official-docs/stage/:slug` via existing api client
- [x] Build payload: mapped vs unmapped; `locale = getLastOfficialDocsLocale() || "en"`  
  - Locale pref source: host-provided preference (message/bootstrap) or `"en"` until host replies — document choice in code-summary
- [x] `OpenOfficialDocLink`: accessible name `Docs: <stageDisplayName>`; `data-testid` for StageCard docs control
- [x] Replace StageCard `DocsLink` IDE/external path for **official** stages: use OpenOfficialDocLink when in VS Code webview
- [x] MUST NOT call `docsOpenHref` / `openDocInIde` / `openExternal` on this mapped StageCard path
- [x] Legacy `open-doc` / `docsOpenHref` remain for non-official surfaces (guides, etc.)

### Step 6: Locale preference read for payload — US-B3-01

- [x] Ensure dashboard can read last locale for payload construction (host `get`/`push` or cached from last inject / LocaleControl state — prefer host `globalState` via small API or message)
- [x] Default `"en"` when unset

### Step 7: Host unit tests — US-B3-01/03

- [x] Tests: valid mapped → persist + inject; unmapped → inject locale-only; invalid locale → ignore; empty path → ignore; no `vscode.open` on success

### Step 8: Dashboard unit tests — US-B3-01/02/03/05/06 (C1–C5 subset)

- [x] Payload builder: mapped / unmapped / locale default
- [x] StageCard / OpenOfficialDocLink: accessible name includes stage display name (≠ bare `Docs`)
- [x] Mapped path does not call `openDocInIde` / set `open-doc` message
- [x] Store: deep-link with required locale; one-shot clear still works
- [x] DocsShell applies locale from deep-link
- [x] Boundary: `dependency-direction.test.ts` still green (no official-docs import)

### Step 9: Map lock / regression — US-B3-04

- [x] Confirm existing `packages/official-docs/tests/stage-map.test.ts` covers 7 slugs — **do not change STAGE_DOC_MAP**
- [x] Add/keep api-core stage route test if gap (null vs mapped)

### Step 10: Demo record + check matrix note — US-B3-06

- [x] Write `construction/docs-navigation/code-generation/demo-record.md` (or under unit verify path per team practice) with intent-capture StageCard → Docs Shell steps
- [x] Document C1–C7 mapping to tests / manual demo in code-summary
- [x] Run `bun run check` (or package-scoped tests) before handoff

### Explicit non-goals

- [x] No new GitHub Actions workflow
- [x] No STAGE_DOC_MAP path/anchor edits
- [x] No B4 BridgeRedirectPanel / B5 upstream report
- [x] No new 95% branch coverage floor

## Test config

- [x] Use existing vitest configs (`packages/dashboard`, `packages/vscode-extension`, `packages/shared-types` as needed) — no new vitest root config unless required
