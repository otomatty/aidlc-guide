# Functional Design 質問 — Unit: btw

> ステージ: functional-design (Construction 3.1) / Unit: btw (kind: service, S) / 2026-07-23
> 入力: unit-of-work.md U3 + unit-of-work-story-map.md（US-06/07/08）+ requirements.md FR-3 + components.md C7 + component-methods.md（btw CLI 表）+ services.md S3

## 質問なし（Construction の質問は例外運用）

btw の設計判断は上流で全て確定済みのため、本 Unit に未決の設計ギャップは無い:

- コマンド仕様（`btw` / `--fork` / `-p` / `--help`）→ requirements FR-3.1〜3.4 の AC + component-methods.md CLI 表
- OS 別 spawn（process.platform 分岐、macOS=`open -a Terminal` 相当 / Windows Git Bash=`cmd start` 相当）→ stories US-06 AC
- fork 制約の help 明記 + `/branch` 第一案内 → FR-3.4 / C-T5
- 完全独立 Unit（reader-core 非依存）→ unit-of-work-dependency.md

[Answer]: N/A（質問なし — ただしレビューで cwd→slug 変換の未定義が1件検出され、実環境の観測（C:/work/aidlc-guide → C--work-aidlc-guide）に基づく変換規則を business-logic-model.md に定義して解消。人間への質問は不要だった）
