# Intent Statement — Docs i18n（拡張内蔵ドキュメント）

> ステージ: intent-capture (Ideation 1.1) / 作成日: 2026-07-31  
> Intent: `260730-docs-i18n`  
> 根拠: ユーザー記述 + [intent-capture-questions.md](./intent-capture-questions.md) の回答  
> 前提: 先行 intent `260720-aidlc-guide-prd`（AIDLC Guide）は完了済み。本 intent はその上への機能追加。

## Problem Statement（解決する業務課題）

AIDLC Guide はワークフローの現在地と学習者向け解説を拡張内で提供できるが、**公式ドキュメント体験はまだ完結していない**（Q1 = D）:

- **理解**: 公式 docs は英語中心で、経験の浅いエンジニアがワークフロー中に読み進めにくい
- **完結**: 詳細を知るにはワークスペース外やブラウザへ飛び、拡張内で学びを閉じられない
- **鮮度**: aidlc-workflows 更新に日本語説明が追従せず、古いまま残る／社内で別サイトを持つ運用コストがかかる

直接のトリガーは、**社内で日本語ドキュメントサイトを別途運用したくない**こと（Q4 = C）。公式相当を拡張に寄せ、更新は差分と承認のある運用にしたい。

## Target Customer（誰がどう恩恵を受けるか）

**主受益者は aidlc-workflows 経験の浅いエンジニア**（Q2 = A）。日本語で公式相当を、拡張内の同じ UI から読みたい。

| ペルソナ | 恩恵 |
|---------|------|
| 初学者エンジニア（主） | en/ja 切替可能な公式相当ドキュメントをオフラインでも読める |
| ドライバー | 拡張内で docs を見せながら説明できる（副次） |
| ドキュメント整備担当 | upstream 差分レポートを受け、翻訳・承認を別 PR で回せる（運用側） |

## Success Metrics（測定可能な成果）

本リリースの「できた」定義の中核（Q3 = A）:

- **S-docs-1（必須）**: 拡張内で **en / ja を同じ目次・同じスタイルで切り替え**て公式相当を読める

スコープ上の前提として合意済みだが、Q3 では必須指標に含めなかった項目（後段で受入に落とす候補）:

- 公式本文の拡張同梱・オフライン可読（初期ツリーは Q5）
- upstream 更新時の差分レポートと、承認後のみの `ja` 反映（運用は Q6）
- 既存 StageCard / docs-bridge 深リンクとの接続（関係は Q7）

## Initiative Trigger（なぜ今か）

- 社内で日本語ドキュメントサイトを別途運用したくない（主トリガー — Q4 = C）
- AIDLC Guide 本体（可視化・ガイド）が揃い、次の価値として「公式 docs の二言語内蔵」が自然に載るタイミング

## Initial Scope Signal（初期スコープの手がかり）

- **同梱ツリー（初期）**: `docs/guide/` + `docs/reference/`（Q5 = B）。harness-engineering 等は初期対象外
- **更新運用**: 差分レポートは自動化し、**翻訳・承認は手動で別 PR**（Q6 = B）。機械翻訳のそのまま同梱はしない
- **既存 Docs Bridge**: **置き換え** — 本文の正本は同梱二言語サイト。`bridge-map` はナビ／用語の補助に残す（Q7 = A）
- **技術境界（アーキテクト観点）**: ローカル専用・実行時に公式 docs を fetch しない。更新は拡張リリース／リポジトリ更新の単位。aidlc-workflows 本体は変更しない（project Forbidden を継承）
- **ワークフロー計画**: compose 承認済み — stock **mvp** 形（22 EXECUTE / 10 SKIP）。Operation および market-research / team-formation / approval-handoff は SKIP

## 前提（Assumption）

- 原文（en）は upstream スナップショットを同梱する。日本語（ja）は人間承認後にのみ更新する
- 言語切替は UI の locale 切替であり、ページ構造・アンカーは en を正とする平行ツリー
- 先行 intent の docs-bridge / dashboard / vscode-extension を brownfield として延長する
