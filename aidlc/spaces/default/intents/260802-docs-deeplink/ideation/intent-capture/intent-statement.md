# Intent Statement — Docs i18n Bolt 3（StageCard Deep Links）

> ステージ: intent-capture (Ideation 1.1) / 作成日: 2026-08-02  
> Intent: `260802-docs-deeplink`  
> 根拠: ユーザー記述 + [intent-capture-questions.md](./intent-capture-questions.md) の回答（推奨適用）  
> 前提: Bolt 1 PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)、Bolt 2 PR [#34](https://github.com/otomatty/aidlc-guide/pull/34) マージ済み。追跡 Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29)。

## Problem Statement（解決する業務課題）

Bolt 2 で拡張内 Docs Shell の locale／未訳／アンカー着地は成立したが、**StageCard から公式 docs への導線がまだ拡張外**（Q1 = D）:

- **着地**: 「docs を開く」が外部ブラウザまたはワークスペースファイルを開き、Docs Shell に入らない
- **map**: 親で用意した 7 slug 静的 map（`stage-map`）が StageCard から使われていない
- **ラベル**: どのステージの公式説明かがリンク文言だけでは伝わりにくい（bare `Docs` 禁止）

本 intent はこの三点を **US-05 契約として再固定し実装で満たす**（Q6 = C）。B4 Bridge・B5 差分レポート・Bolt 2 再実装はスコープ外（Q5 = E）。

## Target Customer（誰がどう恩恵を受けるか）

**主受益者はドライバー**（Q2 = C）。モブ中に StageCard から公式説明を拡張内で開き、コンテキストを切り替えずに説明できる。経験の浅いエンジニアは副次受益者として、現在ステージの公式 docs にすぐ辿り着ける。

| ペルソナ | 恩恵 |
|---------|------|
| ドライバー（主） | StageCard → Docs Shell で外部ブラウザなしに説明できる |
| 初学者エンジニア（副次） | 現在ステージの公式説明へ迷わず着地 |
| ドキュメント整備担当 | 7 slug map が UI 経路で使われ、未マップは Shell top にフォールバック |

## Success Metrics（測定可能な成果）

Bolt 3 の DoD（Q3 = A–F、Issue #29）:

- **7 slug map**: StageCard 経由で静的 map が解決される
- **ラベル**: bare `Docs`  alone ではない
- **payload**: `{locale, path, anchor?}` を openOfficialDoc 相当で発行
- **内部着地**: マップ済みは外部ブラウザを開かない
- **unmapped**: Docs Shell 先頭（top）
- **Demo**: intent-capture StageCard → Docs Shell 着地

親の信頼仮説「ドライバーが StageCard から拡張内 docs に着地できる」を本 Bolt の中核とする。

## Initiative Trigger（なぜ今か）

- Bolt 2（PR #34 / #28）マージ後、delivery-planning の直列 Bolt 3 が次手（Q4 = D）
- Issue #29 で追跡可能
- StageCard がレガシー `docsOpenHref` / IDE open のままであることが確認済み

## Initial Scope Signal（初期スコープの手がかり）

- **Units**: `docs-navigation`（StageCard + openOfficialDoc）
- **Stories**: US-05（親 intent から継承）
- **Brownfield**: Docs Shell deep-link 着地口・`STAGE_DOC_MAP`・`/api/official-docs` を前提（Q6 = C）
- **境界継承**（Q7 = A）: ローカル専用・実行時 fetch なし・content-tree 切替・aidlc-workflows 本体は触らない・深リンクは拡張ホスト内で完結
- **Out of scope**: B4 Bridge（#30）、B5 差分レポート（#31）、locale/untranslated 再実装、大規模ツリー追加
- **Workflow**: stock **feature** scope。Walking Skeleton は Bolt 1 で済 — 本 intent は通常 Bolt として進行

## 前提（Assumption）

- 親の 7 slug 一覧と `stage-map` パスは変更しない（配線とホスト契約が本 Bolt の差分）
- Docs Shell の path/anchor 着地は Bolt 2 で存在；`locale` 付き payload の適用は本 Bolt で Formal 化
- openOfficialDoc の最終メッセージ type 文字列は Functional Design で固定（親 Open Question 継承）
