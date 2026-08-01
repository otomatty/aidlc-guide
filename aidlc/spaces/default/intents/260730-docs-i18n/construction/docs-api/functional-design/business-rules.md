# Business Rules — Unit: docs-api

> functional-design / docs-api (library) / 2026-07-31

| ID | Rule |
|----|------|
| BR-API-1 | Routes only under `/api/official-docs/...` — never reuse `/api/guides` or `/api/docs-settings` |
| BR-API-2 | Handlers delegate FS work to `@aidlc-guide/official-docs` only |
| BR-API-3 | Responses are ReadResult-shaped JSON consistent with api-core |
| BR-API-4 | `missing_ja` success payload includes notice flag for UI |
| BR-API-5 | `path_rejected` → client-safe 4xx-equivalent ReadResult (no stack/path leak) |
