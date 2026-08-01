# Frontend Components — Unit: docs-shell

> functional-design / docs-shell (ui) / 2026-07-31  
> 上流: interaction-spec.md · mockups.md · design-system-mapping.md · accessibility-checklist.md

| Component | Role |
|-----------|------|
| DocsShell | Layout: header + nav + main |
| LocaleControl | en/ja; aria-current |
| DocsToc | Tree nav; keyboard |
| DocsArticle | MarkdownSurface body + h1 |
| UntranslatedNotice | role=status |
| SourceVersionBadge | Header version |

Reuse: MarkdownSurface, VS Code theme tokens. No dashboard→official-docs import.

## Review

**Reviewer:** aidlc-architecture-reviewer-agent · **Verdict:** READY · **Date:** 2026-07-31
