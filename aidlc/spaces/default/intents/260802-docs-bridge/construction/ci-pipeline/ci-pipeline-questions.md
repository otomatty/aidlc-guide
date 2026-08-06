# CI Pipeline Questions — Docs i18n Bolt 4

> ci-pipeline / 2026-08-05  
> Intent: `260802-docs-bridge`  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [code-summary](../docs-navigation/code-generation/code-summary.md)  
> **Answered:** Yes — recommended defaults (user approve cascade)

---

## Q1. CI tool

- A. Keep existing GitHub Actions `.github/workflows/check.yml`（`bun run check`）（Recommended）
- B. Add CodeBuild / CodePipeline
- X. その他

[Answer]: A

## Q2. Branch strategy

- A. Trunk/`main` + PR to main（既存）（Recommended）
- B. Long-lived release branches
- X. その他

[Answer]: A

## Q3. Quality gates for Bolt 4

- A. No new workflow — existing check + Bridge degrade tests in suite；no new 95% floor（NFR-B4-2）（Recommended）
- B. Add a separate Bridge-only workflow
- X. その他

[Answer]: A

## Q4. Artifacts / deploy

- A. No cloud artifact repo；release = merge + extension/VSIX locally（Recommended）
- B. Push VSIX to marketplace from CI
- X. その他

[Answer]: A

## Consolidated Summary Confirmation

[Answer]: A
