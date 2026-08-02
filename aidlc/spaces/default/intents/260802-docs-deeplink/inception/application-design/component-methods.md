# Component Methods — Docs i18n Bolt 3

> ステージ: application-design / 2026-08-02  
> 上流: [components.md](./components.md) · [requirements.md](../requirements-analysis/requirements.md) · [stories.md](../user-stories/stories.md)  
> 詳細ビジネスルールは Functional Design。ここは公開シグネチャと責務のみ。

## official-docs

### `mapStageToDoc(stageSlug: string): StageDocRef | null`

- **Purpose:** Resolve 7-slug static map（FR-B3-3）.  
- **In:** trimmed stage slug.  
- **Out:** `{ path: string, anchor?: string }` or `null` if unmapped.  
- **Errors:** none（null = unmapped）. Empty/whitespace slug → null.

### `MAPPED_STAGE_SLUGS: readonly string[]`

- Frozen key set for US-B3-04 / C1 tests.

## api-core

### `officialDocsStageMap(stageSlug: string): ReadResult<StageDocRef | null>`

- **Purpose:** Wire-facing lookup so dashboard never imports official-docs（Q1=A）.  
- **Route:** `GET /api/official-docs/stage/:stageSlug`  
- **Out:** Always `{ ok: true, value: StageDocRef | null }` today — map miss is `value: null`, **not** `ok: false`（pure function; no I/O failure mode）.  
- **Dashboard:** treat `value === null` as unmapped payload path; do not show a fetch-error banner for null.

## shared-types

### `OpenOfficialDocPayload`（name may be finalized in FD）

```ts
// Mapped
{ locale: "en" | "ja"; path: string; anchor?: string }  // path length >= 1
// Unmapped
{ locale: "en" | "ja" }  // no path/anchor keys
```

- Discriminant: presence of non-empty `path` vs omit keys（FR-B3-1.1）.  
- Message `type` string → Functional Design（FR-B3-1.4）.

## dashboard

### `buildOpenOfficialDocPayload(stageSlug, localePref): OpenOfficialDocPayload`

- Lookup via api-core stage-map wire.  
- Mapped → `{ locale, path, anchor? }`; unmapped → `{ locale }` only.  
- `locale` = preference || `"en"`.

### `OpenOfficialDocLink` activate

- Accessible name `Docs: <stageDisplayName>`.  
- Emits host message with payload；does **not** call `docsOpenHref` / `openDocInIde` on mapped path.

### DocsShell deep-link apply

- Consume `docsShellDeepLink: { locale?, path?, anchor? } | null` one-shot.  
- Set locale control + fetch/show；anchor via `AnchorApplier`.

## vscode-extension

### `handleOpenOfficialDoc(msg)`

- Validate payload shape（mapped vs unmapped）.  
- Persist `locale` to host `globalState`（key → FD）.  
- Open/front Docs Shell；inject deep-link target including `locale`.  
- Must not open external browser for success paths.  
- Must not initiate outbound HTTP to remote official-docs URLs（NFR-B3-1）.

### `getLastOfficialDocsLocale(): "en" | "ja"`

- Read preference from host `globalState`.  
- If unset **or** stored value is not exactly `"en"` | `"ja"` → return `"en"`（corrupt/unknown → default）.

## Review note

**Reviewer:** aidlc-architecture-reviewer-agent · **Date:** 2026-08-02  
**Finding F3 (MODERATE):** `officialDocsStageMap` Errors field says "N/A for null map miss" but wraps a pure function in `ReadResult`. Clarify the `ok: false` semantics: either "follows existing api-core handler error contract; treat as infrastructure failure → dashboard error state" or "ok: false cannot occur; ReadResult is the api-core uniform return shape." Dashboard needs to know which branch to implement. Also: `getLastOfficialDocsLocale` does not address corrupt/invalid globalState values — specify that invalid stored values fall back to `"en"` so Functional Design includes the validation guard.
