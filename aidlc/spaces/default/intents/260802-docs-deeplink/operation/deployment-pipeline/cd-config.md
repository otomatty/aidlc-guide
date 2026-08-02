# CD Config — Docs i18n Bolt 3

> deployment-pipeline / 2026-08-02  
> 上流: [ci-config.md](../../construction/ci-pipeline/ci-config.md) · [quality-gates.md](../../construction/ci-pipeline/quality-gates.md) · [deployment-architecture.md](../../construction/docs-navigation/infrastructure-design/deployment-architecture.md) · [cicd-pipeline.md](../../construction/docs-navigation/infrastructure-design/cicd-pipeline.md)  
> Q1–Q2 = A

## Summary

**No continuous-delivery pipeline to cloud.** NFR-B3-2: local-only VS Code / Cursor extension. Bolt 3 ships via existing extension packaging path.

## Release path

```text
PR → GHA check.yml / bun run check → merge main
  → (optional) bun run build:extension → install VSIX in VS Code / Cursor
  → smoke: intent-capture StageCard → Docs Shell (demo-record.md)
```

## Artifacts

| Artifact | Produced by | Distributed how |
|----------|-------------|-----------------|
| StageCard / OpenOfficialDocLink | dashboard bundle | Webview in extension |
| Host `open-official-doc` | vscode-extension | Extension host |
| VSIX | `build:extension` scripts | Manual install / existing channel |

## Explicit non-goals

- No CodeDeploy / ECS / Lambda / S3 / marketplace auto-publish in this intent

## Review

**Verdict:** READY
