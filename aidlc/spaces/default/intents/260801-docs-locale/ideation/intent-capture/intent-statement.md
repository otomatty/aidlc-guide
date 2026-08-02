# Intent Statement — Docs i18n Bolt 2（Locale + Untranslated）

> ステージ: intent-capture (Ideation 1.1) / 作成日: 2026-08-01  
> Intent: `260801-docs-locale`  
> 根拠: ユーザー記述 + [intent-capture-questions.md](./intent-capture-questions.md) の回答  
> 前提: 親 intent `260730-docs-i18n`（Bolt 1）は PR [#26](https://github.com/otomatty/aidlc-guide/pull/26) でマージ済み。追跡 Issue [#28](https://github.com/otomatty/aidlc-guide/issues/28)。

## Problem Statement（解決する業務課題）

Bolt 1 で拡張内 Docs Shell・locale 制御・同梱コンテンツの縦スライスは成立したが、**部分 `ja` の状態では切替体験が未完成**（Q1 = D）:

- **切替**: 同一 path で en↔ja を切り替えても、keep-path と未訳の見え方が曖昧で迷子になりうる
- **未訳**: `ja` 欠落ページで locale が `en` に戻る／気づかず英語を読む
- **アンカー**: 欠落アンカー時に意図した位置へ着地できない

本 intent はこの三点を **契約として再固定し実装で満たす**（Q6 = C）。B3 以降（深リンク・Bridge・差分レポート）はスコープ外（Q5 = E）。

## Target Customer（誰がどう恩恵を受けるか）

**主受益者は aidlc-workflows 経験の浅いエンジニア**（Q2 = A）。部分 `ja` でも locale を `ja` のまま維持し、未訳であることを notice で明示されたうえで読み進められる。

| ペルソナ | 恩恵 |
|---------|------|
| 初学者エンジニア（主） | keep-path 切替・未訳 notice・アンカーフォールバックで迷わない |
| ドライバー（副次） | モブ中に locale を切り替えて説明できる（Bolt 1 継承） |
| ドキュメント整備担当 | coverage 床で未訳分岐の品質が CI で担保される |

## Success Metrics（測定可能な成果）

Bolt 2 の DoD（Q3 = A, B, C, D）:

- **keep-path**: 同一 path で en↔ja 切替可能
- **missing ja**: notice（`role=status`）表示、locale は `ja` のまま
- **missing anchor**: ページ先頭へフォールバック
- **coverage**: official-docs の branch coverage 床が `bun run check` で効く

親 intent の **S-docs-1**（拡張内 en/ja 切替）を、部分 `ja` でも成立させることが本 Bolt の中核。

Codex の Docs Shell `h1` 指摘（Q3-E）は今回の必須 DoD には含めない（任意フォローアップ）。

## Initiative Trigger（なぜ今か）

- Bolt 1（PR #26）マージ後、delivery-planning の直列 Bolt 2 が次手（Q4 = D）
- Issue #28 で追跡可能にしたうえで実装開始
- 部分 `ja` UX の粗さは手動確認でも認識済み

## Initial Scope Signal（初期スコープの手がかり）

- **Units**: `docs-shell`（完成）+ `official-docs`（missing_ja / anchor 分岐）
- **Stories**: US-03, US-04（親 intent から継承）
- **Brownfield**: 既存 `packages/official-docs`・Docs Shell・`/api/official-docs` を前提（Q6 = C）
- **境界継承**（Q7 = A）: ローカル専用・実行時 fetch なし・content-tree 切替・aidlc-workflows 本体は触らない
- **Out of scope**: B3 StageCard 深リンク（#29）、B4 Bridge（#30）、B5 差分レポート（#31）、大規模ツリー追加
- **Workflow**: stock **feature** scope（32 EXECUTE / Operation SKIP）。Walking Skeleton は Bolt 1 で済 — 本 intent は通常 Bolt として進行

## 前提（Assumption）

- 親 intent の locale コード（`en`/`ja`）、同梱ツリー構造、API パスは変更しない
- 未訳/anchor の振る舞いは functional-design で契約として再固定する（Q6 = C）
- h1 a11y 修正は Bolt 2 必須外だが、同 PR で直してもよい
