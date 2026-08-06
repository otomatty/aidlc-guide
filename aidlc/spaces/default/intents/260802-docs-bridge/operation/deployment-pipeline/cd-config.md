# CD Config — Docs i18n Bolt 4

> deployment-pipeline / 2026-08-05  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [cicd-pipeline.md](../../construction/docs-navigation/infrastructure-design/cicd-pipeline.md)  
> Q1–Q2 = A

## Summary

**No continuous-delivery pipeline to cloud.** NFR-B4-3: local-only VS Code / Cursor extension. Bolt 4 ships via existing extension packaging path.

## Release path

```text
PR → GHA check.yml / bun run check → merge main
  → (optional) bun run build:extension → install VSIX in VS Code / Cursor
  → smoke: StageCard / Bridge → Open in Docs → Docs Shell (demo-record.md)
```

## Artifacts

| Artifact | Produced by | Distributed how |
|----------|-------------|-----------------|
| StageCard (no excerpt) / OpenOfficialDocLink | dashboard bundle | Webview in extension |
| Host `open-official-doc` (reuse) | vscode-extension | Extension host |
| VSIX | `build:extension` scripts | Manual install / existing channel |

## Explicit non-goals

- No CodeDeploy / ECS / Lambda / S3 / marketplace auto-publish in this intent

## Review

**Verdict:** READY
