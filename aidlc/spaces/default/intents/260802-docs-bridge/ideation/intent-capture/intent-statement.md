# Intent Statement — Docs i18n Bolt 4（Bridge Degrade）

> ステージ: intent-capture (Ideation 1.1) / 作成日: 2026-08-03  
> Intent: `260802-docs-bridge`  
> 根拠: ユーザー記述 + [intent-capture-questions.md](./intent-capture-questions.md) の回答（推奨適用 → Looks correct）  
> 前提: Bolt 1 PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)、Bolt 2 PR [#34](https://github.com/otomatty/aidlc-guide/pull/34)、Bolt 3 intent `260802-docs-deeplink` / Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29) 完了。追跡 Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)。

## Problem Statement（解決する業務課題）

Bolt 3 で StageCard → openOfficialDoc → Docs Shell 着地は成立したが、**Legacy Bridge 経路がまだ正本扱いになり得る**（Q1 = D）:

- **二重正本**: Bridge が excerpt を記事のようにマウントし、同梱 Docs と競合する
- **CTA**: Bridge から Docs Shell への「Open in Docs」が一次導線になっていない
- **補助（Should）**: glossary / US-09 補助 UI は残っていても切下げ可（Must ではない）

本 intent はこの degrade 契約を **US-06 として Formal に再固定し実装で満たす**（Q6 = C）。B5 差分レポート・Bolt 2/3 再実装はスコープ外（Q5 = E）。

## Target Customer（誰がどう恩恵を受けるか）

**主受益者はドライバー／モブ参加者**（Q2 = C）。Legacy Bridge から迷わず同梱 Docs に移れる。初学者は副次受益者として、正本が一箇所であることで学習コストが下がる。

| ペルソナ | 恩恵 |
|---------|------|
| ドライバー／モブ参加者（主） | Bridge → Open in Docs → Shell で正本に着地できる |
| 初学者エンジニア（副次） | 「読む場所は同梱 Docs のみ」が体験として成立する |
| ドキュメント整備担当 | Bridge を正本から外し、運用を単純化できる |

## Success Metrics（測定可能な成果）

Bolt 4 の DoD（Q3 = A–E、Issue #30）:

- **excerpt 非マウント**: excerpt が記事としてマウントされない
- **primary CTA**: **Open in Docs** が一次 CTA
- **US-09**: glossary / 補助は Should — DoD 必須にしない（切下げ可）（Q8 = A）
- **Demo**: Legacy Bridge → Open in Docs → Shell
- **信頼仮説**: 「正本は同梱 Docs のみ」がデモで示せる

## Initiative Trigger（なぜ今か）

- Bolt 3（docs-deeplink / #29）完了後、delivery-planning の直列 Bolt 4 が次手（Q4 = D）
- Issue #30 で追跡可能
- Legacy Bridge がまだ正本扱いになり得る経路として残っている

## Initial Scope Signal（初期スコープの手がかり）

- **Units**: `docs-navigation`（`BridgeRedirectPanel`）
- **Stories**: US-06（Must）；US-09（Should / optional）
- **Brownfield**: Docs Shell・`openOfficialDoc`・`/api/official-docs` を前提に Bridge 差分のみ（Q6 = C）
- **境界継承**（Q7 = A）: ローカル専用・実行時 fetch なし・content-tree 切替・aidlc-workflows 本体は触らない・Bridge degrade は拡張ホスト／Dashboard 内で完結
- **Out of scope**: B3 deep links 再実装、B5 差分レポート（#31）、locale/untranslated 再実装、大規模ツリー追加
- **Workflow**: stock **feature** scope。Walking Skeleton は Bolt 1 で済 — 本 intent は通常 Bolt として進行

## 前提（Assumption）

- Bolt 3 の `openOfficialDoc` / Docs Shell 着地口を Bridge の primary CTA が再利用する
- BridgeRedirectPanel の最終 UI 文言・メッセージ type は Functional Design で固定
- US-09 を切下げても US-06 DoD（excerpt 非マウント + Open in Docs primary + Demo）だけで Bolt 4 は完了とみなす
