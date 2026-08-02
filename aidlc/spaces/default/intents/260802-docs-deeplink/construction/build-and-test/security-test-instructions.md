# Security Test Instructions — Docs i18n Bolt 3

> build-and-test / 2026-08-02  
> 上流: [security-requirements](../docs-navigation/nfr-requirements/security-requirements.md) · [security-design](../docs-navigation/nfr-design/security-design.md) · [code-summary](../docs-navigation/code-generation/code-summary.md)

## Controls

| Req | Test |
|-----|------|
| S-B3-DN-1 Host validate / ignore | `open-official-doc.test.ts` invalid locale / empty path |
| S-B3-DN-2 No remote fetch | Design + code review (local api-core / official-docs) |
| S-B3-DN-3 No open-doc on mapped StageCard | `open-official-doc.test.tsx` StageCard path |
| S-B3-DN-4 No dashboard→official-docs | `dependency-direction.test.ts` |

## How to run

```bash
bunx vitest run packages/vscode-extension/tests/open-official-doc.test.ts
bunx vitest run packages/dashboard/tests/open-official-doc.test.tsx
bunx vitest run packages/dashboard/tests/dependency-direction.test.ts
```

## Review

**Status:** Executed
