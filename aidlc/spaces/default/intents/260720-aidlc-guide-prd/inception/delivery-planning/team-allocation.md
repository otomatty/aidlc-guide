# Team Allocation — AIDLC Guide

> ステージ: delivery-planning (Inception 2.8) / 作成日: 2026-07-23
> 入力: bolt-plan.md + team-practices.md。team-formation (1.5) はスコープ SKIP。

## 割当

team-formation が SKIP のため、**全 Bolt を aidlc-developer-agent（AI）が実行**する（stage 既定どおり）。人間の関与はゲート承認・質問回答・walking-skeleton 承認 + ラダープロンプト選択。

| Bolt | 実行 | 人間の関与 |
|------|------|-----------|
| B1 walking-skeleton | aidlc-developer-agent | **ゲート必須承認** + ラダープロンプト（以降の autonomy 選択） |
| B2〜B7 | aidlc-developer-agent | autonomy モード（ラダーの選択）に従う。失敗時は常に halt-and-ask |

## 運用ノート

- Construction worktree: base = `main`、merge 先 = `main`、Bolt は squash-merge（team.md Way of Working）。
- B4 ∥ B5 の並行実行時も、各 Bolt は独立 worktree で分離（bolt-plan.md Q3）。
- Program Board は不要（チーム数 = 1）。
