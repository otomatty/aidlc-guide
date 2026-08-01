# Design System Mapping — Docs i18n

> ステージ: refined-mockups / 2026-07-31  
> 決定: Q4=A — 既存 AIDLC Guide Webview + VS Code theme tokens。新規 DS なし。  
> 上流: wireframes.md · mockups.md · team-practices.md · requirements.md · stories.md · user-flow.md

## Principle

Reuse `packages/dashboard` patterns (shadcn-style primitives already mapped to VS Code CSS variables in `globals.css`). Official-docs Shell is a **new route/surface**, not a new visual language.

## Token mapping

| UI need | Source | Notes |
|---------|--------|-------|
| Foreground / background | VS Code webview theme vars via existing semantic tokens | Follow `globals.css` bridge |
| Borders / muted | Existing `--border`, muted foreground | Header + TOC separators |
| Focus ring | Existing focus-visible styles | Locale + TOC + links |
| Primary action | Existing button / link primary | Bridge “Open in Docs”, StageCard docs link |
| Status / notice | Existing alert/callout if present; else bordered note + icon/text | Not color-only (US-04) |
| Code / markdown | Existing `MarkdownSurface` / reader styles | Prefer shared markdown pipeline |

## Component reuse vs new

| Refined component | Reuse | New |
|-------------------|-------|-----|
| LocaleControl | Segmented control / toggle patterns if any | Thin docs-specific wrapper OK |
| DocsToc | Nav list / collapsible tree patterns | Tree data from official-docs index |
| Markdown body | `MarkdownSurface` / viewer | Wired to `/api/official-docs/:locale/*` |
| UntranslatedNotice | Alert/callout | Copy + `role="status"` |
| OpenOfficialDocLink | StageCard link slot (`DocsLink` evolution) | Payload shape per FR-U3; stop bare “Docs” |
| BridgeRedirectPanel | Card/panel primitives | Remove excerpt-as-body |

## Naming / routes (practices)

| Concern | Mapping |
|---------|---------|
| API | `/api/official-docs/:locale/*` — do **not** reuse `/api/guides` or `/api/docs-settings` for official bodies |
| Trees | `docs/guide\|reference/<locale>/` ≠ product `docs/guides/` |
| Locales | `en` / `ja` only for MVP |

## Responsive (Q6=A)

| Width | Layout |
|-------|--------|
| Narrow Webview | TOC collapsed (Contents toggle); header keeps locale + version |
| Wide Webview | W1 two-pane (nav + main) |

No mobile-web marketing breakpoints; host is IDE panel.

## Explicit non-goals

- New brand palette / illustration system  
- Matching external aidlc-workflows website CSS 1:1  
- Browser-only Dashboard skin  
