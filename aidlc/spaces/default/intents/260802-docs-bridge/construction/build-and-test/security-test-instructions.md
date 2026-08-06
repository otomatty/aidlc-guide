# Security Test Instructions — Docs i18n Bolt 4

> build-and-test / 2026-08-05  
> 上流: [security-requirements](../docs-navigation/nfr-requirements/security-requirements.md) · [code-summary](../docs-navigation/code-generation/code-summary.md)

## Checks

| Req | How |
|-----|-----|
| S-B4-DN-1 Host validate | Extension open-official-doc tests (reuse) |
| S-B4-DN-2 No remote fetch | Code review + open-official-doc path |
| S-B4-DN-3 No openExternal / open-doc on IDE CTA | dashboard open-official-doc tests |
| S-B4-DN-4 No dashboard→official-docs import | dependency-direction.test.ts |
| S-B4-DN-5 Excerpt UI non-mount | components.test.tsx |

## How to run

```bash
bunx vitest run \
  packages/dashboard/tests/open-official-doc.test.tsx \
  packages/dashboard/tests/components.test.tsx \
  packages/dashboard/tests/dependency-direction.test.ts \
  packages/vscode-extension/tests/open-official-doc.test.ts
```

## Review

**Status:** Executed via focused suite
