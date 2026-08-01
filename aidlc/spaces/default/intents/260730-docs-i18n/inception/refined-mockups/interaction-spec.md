# Interaction Spec — Docs i18n

> ステージ: refined-mockups / 2026-07-31  
> 形式: component-spec-template · 上流: mockups.md · stories.md · wireframes.md · requirements.md · user-flow.md · team-practices.md

## Shell states（Docs Shell / RM1）

| State | Description | Trigger | UI |
|-------|-------------|---------|-----|
| loading | Content fetch in-host | open page / locale change | TOC may stay; main shows busy/skeleton (no spinner-only) |
| empty | Snapshot missing | US-01 not done | main explains content unavailable; no fake pages |
| error | Load fail / guardPath reject | bad path or IO error | non-color error in main; retry or pick TOC |
| ready | Body rendered | successful load | h1 + body |
| partial | Untranslated (US-04) | locale=ja, ja file missing | status notice + en body; locale stays ja |

---

## LocaleControl

| Field | Value |
|---|---|
| Component | LocaleControl |
| Description | Switch en ↔ ja in Docs Shell header |
| Category | input / navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | Shows current locale | page load / preference |
| focus | Keyboard focus on segment | Tab |
| switching | Brief busy while load | activate other locale |
| disabled | Only if single locale shipped (not MVP default) | prop |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| value | `"en" \| "ja"` | yes | preference \|\| `en` | Current locale |
| onChange | `(locale) => void` | yes | — | Keep path; resolve anchor per US-03 |
| sourceVersion | string | yes | from manifest | Displayed adjacent in header |

### Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| narrow Webview | Compact segmented control; version may truncate with title tooltip |
| wide Webview | Full labels `en` / `ja` + full `sourceVersion` |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA | `radiogroup` or toggle buttons; active has `aria-current="true"` or `aria-pressed` |
| Keyboard | Left/Right or Tab between options; Enter/Space activate |
| Label | Visible “Locale” or equivalent; not color-only |
| Focus | After switch: target heading or page top (US-03), not lost to body start blindly without announcement |
| Screen reader | Announce new locale; untranslated uses separate status on RM2b |

### Usage Example

```
<LocaleControl value={locale} onChange={setLocale} sourceVersion={manifest.sourceVersion} />
```

---

## DocsToc

| Field | Value |
|---|---|
| Component | DocsToc |
| Description | Hierarchical nav for guide + reference |
| Category | navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | Tree rendered | shell ready |
| selected | Current path highlighted | navigation |
| collapsed | Narrow panel | toggle / narrow |
| empty | No tree yet | empty shell state |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| tree | TocNode[] | yes | — | From bundled index |
| activePath | string | yes | — | Current page path |
| onSelect | `(path) => void` | yes | — | Load via official-docs API |
| locale | `"en" \| "ja"` | yes | — | Labels follow locale when available |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA | `nav` landmark; links or tree pattern |
| Keyboard | Tab/arrow per chosen pattern; Enter open page |
| Focus | Moving selection updates main; skip link to main available |

---

## UntranslatedNotice

| Field | Value |
|---|---|
| Component | UntranslatedNotice |
| Description | Visible notice when ja missing |
| Category | feedback |

### States

| State | Description | Trigger |
|---|---|---|
| visible | Shown above en body | US-04 |
| hidden | Not mounted | ja file exists or locale=en |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| message | string | yes | 日本語訳はまだありません — 英語を表示しています | Copy |

### Accessibility

| Requirement | Implementation |
|---|---|
| ARIA | `role="status"` (or live polite) |
| Contrast | Text vs background ≥ 4.5:1; not color-only |
| Placement | Inside `main`, before article body |

---

## OpenOfficialDocLink（StageCard）

| Field | Value |
|---|---|
| Component | OpenOfficialDocLink |
| Description | Dashboard → Docs Shell deep link |
| Category | navigation |

### Props / Inputs

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| stageSlug | string | yes | — | Map lookup |
| label | string | yes | — | Must not be bare `Docs` |
| payload | `{locale,path,anchor?}` | yes | from map + preference | Host command/postMessage |

### Accessibility

| Requirement | Implementation |
|---|---|
| Role | link or button |
| Name | Accessible name = visible purpose label |
| Focus | Lands in Docs Shell per RM3 |

### Interaction

1. Activate → host `openOfficialDoc`-style message (name pinned in Functional Design)  
2. Unmapped slug → Shell top  
3. Anchor missing on page → page top  

---

## BridgeRedirectPanel

| Field | Value |
|---|---|
| Component | BridgeRedirectPanel |
| Description | Degrade excerpt UI to Docs CTA |
| Category | display / navigation |

### States

| State | Description | Trigger |
|---|---|---|
| default | Note + primary Open in Docs | render |
| withGlossary | Optional US-09 aids | Should |

### Rules

- Excerpt markdown **not** mounted as main article  
- Primary activation = Open in Docs → RM1  
- Optional short note allowed  

### Accessibility

| Requirement | Implementation |
|---|---|
| Heading | h2 e.g. 「公式ドキュメントは拡張内へ」 |
| Landmark | `main` (panel) |
| Keyboard | Primary control first focusable action |

---

## Flow crosswalk

| Flow (user-flow.md) | Components |
|---------------------|------------|
| A Browse & switch | LocaleControl, DocsToc, UntranslatedNotice |
| B Context jump | OpenOfficialDocLink → Shell |
| C Bridge | BridgeRedirectPanel |
