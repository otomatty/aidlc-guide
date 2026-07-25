# CI Pipeline 質問 — AIDLC Guide

> ci-pipeline (3.7) / lead: pipeline-deploy / 2026-07-26
> 入力: 全9 Unit の `code-summary.md` + `build-and-test/build-and-test-summary.md` + `build-and-test/build-test-results.md`
> 注: ステージ標準の定型質問（CodePipeline / CodeBuild / ECR / CodeArtifact 等）は**本プロジェクトに不適用**。project.md Decided「クラウド・AWS を一切使用しない」および Forbidden「クラウド/AWS サービス依存を追加しない」により、AWS 系の選択肢は最初から候補に無い。したがって以下は本プロジェクト固有の実質的な設計判断のみを問う。

## Q1: 「CI」をどの形で実装するか

本プロジェクトはローカル専用ツールで、ホスト型 CI 基盤を持たない。team.md は「CI 基盤がないため、この単一ローカルコマンド（`bun run check`）が唯一のゲート」と定めている。この前提のもとで CI をどう具体化するか。

- A. ローカル git フックのみ（pre-push で `bun run check`。ホスト型 CI は導入しない）
- B. A に加えて GitHub Actions の workflow も同梱（将来 GitHub にリモートを持つ場合に備える）
- C. 文書のみ（自動化なし）

[Answer]: B（GitHub Actions も同梱）

**採否の帰結**: 検証手段が2系統になる。ローカルフックは本ステージで実行して検証できるが、**workflow は現時点でリモートが無いため未検証のまま出荷される**。この非対称性を `ci-config.md` に明記し、リモート接続時の初回実行を受入条件として残す。

## Q2: git リポジトリの未初期化をどう扱うか

org.md は trunk-based development（`main` へ squash-merge）を定め、`docs/guides/async-sharing.md` の非同期共有規約も git を前提とするが、ワークスペースは現時点で git リポジトリではない（`git rev-parse` が `fatal: not a git repository`）。

- A. 未実施として記録し、`git init` は人の判断に委ねる（リモート先・公開範囲の決定を伴うため）
- B. この場で `git init` して `main` ブランチと初回コミットまで行う（リモートは設定しない）

[Answer]: B（git init も実行。リモートは設定しない）

**採否の帰結**: リモート設定を伴わないため、公開範囲に関する判断は発生しない（ローカルの履歴が生まれるだけ）。ただし `.gitignore` の正しさが初回コミットの内容を決めるため、**コミット前に除外対象を実測で確認する**こと（per-user カーソル・clone id・runtime-graph・machine-local が入らないこと）。

## Q3: ブランチ戦略と品質ゲート（既定の再確認 — 新規の問いではない）

org.md / team.md で確定済みのため質問として開かない。本ステージはこれを実装に落とすのみ:

- ブランチ戦略: trunk-based。`main` から切った短命ブランチ、`main` へ **squash-merge**（org.md、team.md Q1 で確定）
- マージ前ゲート: `bun run check` = Biome + `tsc --noEmit` ×2 + Vitest（カバレッジ閾値込み）+ `bun audit`（team.md Testing Posture / project.md Mandated）
- 成果物リポジトリ（ECR / CodeArtifact / S3 等）: **該当なし**。配布はローカル実行手順のみで、ビルド成果物を外部に置かない（team.md Deployment）

[Answer]: 確定済み。再質問しない。
