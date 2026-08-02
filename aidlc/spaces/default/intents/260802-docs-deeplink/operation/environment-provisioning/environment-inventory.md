# Environment Inventory — Docs i18n Bolt 3

> environment-provisioning / 2026-08-02  
> 上流: [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [cd-config.md](../deployment-pipeline/cd-config.md) · [ci-config.md](../../construction/ci-pipeline/ci-config.md)  
> Q1–Q2 = A · `infrastructure-services` N/A for ui（not produced）

## Cloud / AWS

**None provisioned.** NFR-B3-2 local-only.

## Environments that exist

| Env | Type | Notes |
|-----|------|-------|
| Developer workstation | Local | bun, VS Code / Cursor, workspace checkout |
| GitHub Actions runners | Ephemeral CI | ubuntu / windows / macos (`check.yml`) |
| Extension host | Desktop | vscode-extension Webview + openOfficialDoc handler |

## Shared local resources

| Resource | Path / package |
|----------|----------------|
| Stage map | `@aidlc-guide/official-docs` STAGE_DOC_MAP (unchanged) |
| Stage API | `@aidlc-guide/api-core` `GET /api/official-docs/stage/:slug` |
| UI | `@aidlc-guide/dashboard` StageCard / DocsShell |
| Host | vscode-extension `open-official-doc` |

## Secrets

No cloud secrets. Host locale preference in extension `globalState` only (`aidlcGuide.officialDocsLocale`).

## Review

**Verdict:** READY
