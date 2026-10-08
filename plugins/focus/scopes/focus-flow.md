---
name: focus-flow
plugin: focus
depth: Standard
testStrategy: Standard
keywords:
  - focus
  - focus-flow
description: Jira チケットから要件・設計・Unit 分割・テスト先行・TDD 実装まで進める（Claude Code 向け、図解中心）
skeleton: off
runner: true
sensors: on
learnings: on
summary_confirmation: on
---

# focus-flow

Jira チケットを起点に、Inception で要件・設計・Unit・Bolt を決め、Construction で
Unit ごとにテストを先に書いてから TDD で実装する。Ideation と Operation は実施しない。

| フェーズ     | ステージ                | 決めること・作るもの                                   |
| ------------ | ----------------------- | ------------------------------------------------------ |
| Inception    | reverse-engineering     | 既存コードの構成（As-Is）。既存の codekb があれば省ける |
| Inception    | requirements-analysis   | 要件と受け入れ条件。確証のない点は宛先つきの質問にする |
| Inception    | domain-design           | 設計。As-Is と To-Be の比較、影響範囲、設計判断        |
| Inception    | units-generation        | Unit と依存関係                                        |
| Inception    | delivery-planning       | Bolt の計画、Construction の進め方、品質ゲートのコマンド |
| Construction | focus-test（Unit ごと） | 失敗するテスト。AI が要件の漏れを確認し、人が最終確認する |
| Construction | focus-implement（Unit ごと） | TDD で実装し、品質ゲートを通す                     |

Construction の進め方（unit-major / stage-major、serial / swarm）と、Unit ごとの
検証コマンドは、標準の Construction の手順で人が選ぶ。

起動: `/aidlc --scope focus-flow PROJ-123 <チケットの要約>`
