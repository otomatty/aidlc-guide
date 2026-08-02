# Code Summary — Unit: docs-navigation (Bolt 3)

> code-generation / docs-navigation (ui) / 2026-08-02  
> Intent: `260802-docs-deeplink` · Issue #29

## Files changed

### Application (workspace root)

| Package | File | Change |
|---------|------|--------|
| shared-types | `src/index.ts` | `StageDocRef`, `OpenOfficialDocMessage`, `DocsShellDeepLinkMessage`, `DocsShellDeepLink` |
| vscode-extension | `src/open-official-doc.ts` | **new** — validate / persist / inject |
| vscode-extension | `src/dashboard-panel.ts` | Wire `open-official-doc` + `ExtensionContext` into `wireWebview` |
| vscode-extension | `tests/open-official-doc.test.ts` | **new** — host unit tests |
| dashboard | `src/store/state.ts` | `docsShellDeepLink` requires `locale`; `officialDocsLocale` |
| dashboard | `src/store/reducer.ts` | Deep-link with locale; `official-docs-locale` action |
| dashboard | `src/services/docs-shell-inject.ts` | **new** — host inject registry (browser-safe) |
| dashboard | `src/services/transport/vscode.ts` | Listen for `docs-shell-deeplink` |
| dashboard | `src/services/api.ts` | `fetchOfficialDocsStageMap` |
| dashboard | `src/services/docs.ts` | `buildOpenOfficialDocMessage`, `openOfficialDocInIde`, `stageDisplayName` |
| dashboard | `src/components/OpenOfficialDocLink.tsx` | **new** — StageCard control |
| dashboard | `src/components/StageCard.tsx` | VS Code → OpenOfficialDocLink (no open-doc path) |
| dashboard | `src/components/DocsShell.tsx` | Apply deep-link locale; LocaleControl ↔ store |
| dashboard | `src/app/App.tsx` | Register deep-link inject → dispatch |
| dashboard | `tests/open-official-doc.test.tsx` | **new** — payload / a11y / store |
| dashboard | `tests/docs-shell.test.tsx` | Locale on deep-link harness + FR-B3-4.3 |
| api-core | `tests/official-docs-routes.test.ts` | stage/:slug mapped vs null |

### Intent artifacts

- `code-generation-plan.md` — all steps checked
- `demo-record.md` — manual demo steps
- this file

## Decisions

1. **Locale preference source:** Host persists to `globalState` key `aidlcGuide.officialDocsLocale`. Dashboard keeps `AppState.officialDocsLocale` (default `"en"`), updated by LocaleControl and by host inject / deep-link. OpenOfficialDocLink reads store locale for payload — no separate host round-trip on click.
2. **stageDisplayName:** StageDoc has no name field; use title-cased slug (`intent-capture` → `Intent Capture`) matching mockup examples.
3. **StageCard split:** VS Code webview → always `OpenOfficialDocLink`. Browser → legacy `docsOpenHref` (NFR-B3-2: browser not Fail).
4. **Inject seam:** Module-level handler registry in `docs-shell-inject.ts` (not vscode transport import from App) so browser bundle stays free of vscode transport.

## C1–C7 → test / demo map

| Check | Coverage |
|-------|----------|
| C1 Mapped open → Shell + path/anchor | Host unit + dashboard payload + DocsShell deep-link test |
| C2 Unmapped → Shell top, locale only | Host unit + payload builder + store locale-only |
| C3 Invalid → ignore | Host unit (locale / empty path) |
| C4 Accessible name includes stage | OpenOfficialDocLink a11y test |
| C5 No open-doc on mapped StageCard | StageCard test asserts no `open-doc` message |
| C6 Locale from deep-link | DocsShell FR-B3-4.3 test |
| C7 Manual StageCard → Shell | `demo-record.md` |

## Deviations

None vs approved plan. STAGE_DOC_MAP untouched. No new vitest root config. No GitHub Actions / Bridge / upstream report.

## Verification run

```text
bunx vitest run \
  packages/vscode-extension/tests/open-official-doc.test.ts \
  packages/dashboard/tests/open-official-doc.test.tsx \
  packages/dashboard/tests/docs-shell.test.tsx \
  packages/dashboard/tests/dependency-direction.test.ts \
  packages/official-docs/tests/stage-map.test.ts \
  packages/api-core/tests/official-docs-routes.test.ts \
  packages/dashboard/tests/components.test.tsx \
  packages/dashboard/tests/vscode-api.test.ts
# → 8 files, 78 tests passed
```

## Review

**Reviewer:** aidlc-architecture-reviewer-agent  
**Date:** 2026-08-02  
**Verdict:** READY  

Plan complete; BLM/message/locale/boundary/StageCard checks pass. Non-blocking: redundant `aria-label` on OpenOfficialDocLink.
