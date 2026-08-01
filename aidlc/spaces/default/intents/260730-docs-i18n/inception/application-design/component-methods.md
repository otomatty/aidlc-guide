# Component Methods — Docs i18n

> ステージ: application-design / 2026-07-31  
> 上流: components.md · requirements.md · stories.md · architecture.md · component-inventory.md · team-practices.md  
> 詳細ビジネスルールは Functional Design。ここは公開面のシグネチャとエラー形。

## Error model

Prefer existing `ReadResult` / `withResult` style:

| Code / kind | Meaning |
|-------------|---------|
| `ok` | Page or TOC loaded |
| `not_found` | Path unknown in locale tree |
| `missing_ja` | Requested ja; serve en body + notice flag (FR-U2.5) |
| `path_rejected` | `guardPath` failed (NFR-2) |
| `empty_content` | Snapshot/manifest missing (US-01 not ready) |

---

## `@aidlc-guide/official-docs`

### `readManifest(workspaceRoot: string): Promise<Result<Manifest>>`

- **Out:** `{ sourceVersion, source, capturedAt }` from `docs/official-docs.manifest.json`  
- **Err:** missing/invalid manifest → `empty_content`

### `resolvePage(input): Promise<Result<ResolvedPage>>`

```text
input: { workspaceRoot, locale: "en"|"ja", path: string, anchor?: string }
ResolvedPage: {
  localeServed: "en"|"ja",
  path, title?, bodyMarkdown,
  notice?: "missing_ja",
  sourceVersion,
  anchorApplied: "scrolled" | "top" | "none"
}
```

- Containment: locale content root + `guardPath`  
- ja missing → `localeServed=en`, `notice=missing_ja`, control locale stays caller's ja  
- Escape path → `path_rejected`

### `listToc(workspaceRoot, locale): Promise<Result<TocTree>>`

- Guide + reference tree for locale (fallback labels from en if needed — detail in FD)

### `mapStageToDoc(stageSlug: string): { path: string, anchor?: string } | null`

- Static map for seven FR-U3.3 slugs; null → Shell top

### Coverage (NFR-3)

- Module branch coverage **95%** Must (practices / stories US-02)

---

## `@aidlc-guide/api-core` (extensions)

### `handleOfficialDocsGet(ctx, url): Promise<Response>`

- Routes under `/api/official-docs/:locale/*`  
- Delegates to `resolvePage` / `listToc` / manifest  
- Must not shadow `/api/guides` or `/api/docs-settings`

---

## `@aidlc-guide/dashboard`

### Docs Shell

| Method / action | Purpose |
|-----------------|--------|
| `openDocsShell(route?)` | Show RM1 |
| `selectToc(path)` | Load page via wire |
| `setLocale(locale)` | US-03/04; keep path |
| `applyDeepLink({locale,path,anchor?})` | RM3 land |

### StageCard

| Method / action | Purpose |
|-----------------|--------|
| `activateOfficialDocLink(stageSlug)` | Emit openOfficialDoc payload; label ≠ bare `Docs` |

### Bridge

| Method / action | Purpose |
|-----------------|--------|
| `renderBridgeRedirect()` | US-06 — no excerpt article; primary Open in Docs |

---

## `vscode-extension`

| Method / command | Purpose |
|------------------|--------|
| `openOfficialDoc(payload)` | Open/focus Docs Shell; apply deep link (name pinned in FD) |
| `get/setDocsLocalePreference()` | workspaceState; default `en` |

---

## `docs-bridge` (narrowed)

| Method | Change |
|--------|--------|
| excerpt-as-body consumers | Remove / no-op for canonical learning body |
| term/nav helpers | May remain for US-09 Should |
