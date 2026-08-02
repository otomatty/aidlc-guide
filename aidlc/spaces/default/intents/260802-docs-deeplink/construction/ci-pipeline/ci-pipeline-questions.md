# CI Pipeline Questions — Docs i18n Bolt 3

> ci-pipeline / 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 上流: [build-and-test-summary.md](../build-and-test/build-and-test-summary.md) · [build-test-results.md](../build-and-test/build-test-results.md) · [code-summary](../docs-navigation/code-generation/code-summary.md)  
> **Recommended** は各問に記す。

---

## Q1. CI tool

- A. Keep existing GitHub Actions `.github/workflows/check.yml`（`bun run check`）（Recommended）
- B. Add CodeBuild / CodePipeline
- X. その他（具体的に記入）

[Answer]: A

## Q2. Branch strategy

- A. Trunk/`main` + PR to main（既存）（Recommended）
- B. Long-lived release branches
- X. その他（具体的に記入）

[Answer]: A

## Q3. Quality gates for Bolt 3

- A. No new workflow — existing check + focused deep-link tests already in suite；no new 95% floor（NFR-B3-3）（Recommended）
- B. Add a separate deep-link-only workflow
- X. その他（具体的に記入）

[Answer]: A

## Q4. Artifacts / deploy

- A. No cloud artifact repo；release = merge + extension/VSIX locally（Recommended）
- B. Push VSIX to marketplace from CI
- X. その他（具体的に記入）

[Answer]: A

## Consolidated Summary Confirmation

- A. Looks correct — generate（Recommended）
- B. Needs revision — (specify)

[Answer]: A
