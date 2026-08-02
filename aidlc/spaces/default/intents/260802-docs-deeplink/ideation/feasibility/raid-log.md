# RAID Log — Docs i18n Bolt 3

> ステージ: feasibility (Ideation 1.3) / 作成日: 2026-08-02  
> 根拠: [feasibility-assessment.md](./feasibility-assessment.md) / [constraint-register.md](./constraint-register.md)  
> 入力参照: [intent-statement.md](../intent-capture/intent-statement.md)

## Risks（リスク）

| ID | 内容 | 影響 | 尤度 | 緩和 |
|----|------|------|------|------|
| R1 | レガシー `docsOpenHref` / IDE open が残り、一部経路で外部ブラウザが開く | US-05「外部ブラウザなし」が破れる | 中 | StageCard DocsLink を openOfficialDoc 一本化。レガシー経路のテストで否定確認 |
| R2 | `{locale,path,anchor?}` の locale が Docs Shell に載らず en 固定のまま | 好み locale で着地できない | 中 | deep-link 状態に locale を含め、Shell 初回適用を FD で固定 |
| R3 | unmapped → top が既存 one-shot deep-link 消費と競合 | 誤 path が残る／二重適用 | 中 | path なし open と consume タイミングを単体テストで固定 |
| R4 | postMessage / コマンド名が dashboard と extension でずれる | クリックしても Shell が開かない | 中 | FD で type 文字列をピン留めし、双方で同じ契約をテスト |
| R5 | B4 Bridge 要求が混入する | スコープクリープ | 低 | intent Q5 = E で除外。変更は #30 |

## Assumptions（前提）

| ID | 内容 | 検証タイミング |
|----|------|----------------|
| A1 | 7 slug map と path/anchor は変更しない（配線が差分） | Scope Definition / FD |
| A2 | Docs Shell の path/anchor 着地口は Bolt 2 で利用可能 | Code Generation |
| A3 | US-05 契約は FD で Formal 再固定（intent Q6 = C） | Functional Design |
| A4 | aidlc-workflows エンジン／ステージ定義は変更しない | 全ステージ |
| A5 | AWS 不使用・ローカル専用は不変 | 全ステージ |

## Issues（顕在課題）

| ID | 内容 | 状態 | オーナー |
|----|------|------|----------|
| I1 | StageCard がまだレガシー docs リンク | Open | Bolt 3 code-gen |
| I2 | deep-link 状態に locale フィールドが未搭載 | Open | Functional Design / code-gen |

## Dependencies（依存）

| ID | 依存先 | 種類 | 備考 |
|----|--------|------|------|
| D1 | Bolt 1/2 成果（Docs Shell・stage-map・locale） | 成果物 | PR #26 / #34 |
| D2 | 親 intent `docs-navigation` 設計メモ | 設計 | FD で再固定 |
| D3 | intent-statement の US-05 DoD | 要件 | 受入の北極星 |
| D4 | GitHub Issue #29 | 追跡 | 実装の進捗管理 |
