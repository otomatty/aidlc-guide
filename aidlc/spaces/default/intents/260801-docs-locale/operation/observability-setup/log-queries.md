# Log Queries — Docs i18n Bolt 2

> observability-setup / 2026-08-02  
> 上流: local-only

## Cloud log groups

**N/A.**

## Local debugging

| Need | Approach |
|------|----------|
| Resolve failures | Re-run official-docs vitest; inspect `path_rejected` / `not_found` |
| UI notice issues | docs-shell tests + Webview DevTools |
| CI failures | GHA logs for `bun run check` |

## Review

**Verdict:** READY
