# Scope Document — Docs i18n

> ステージ: scope-definition (Ideation 1.4) / 作成日: 2026-07-31  
> Intent: `260730-docs-i18n`  
> 根拠: [scope-definition-questions.md](./scope-definition-questions.md)  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [feasibility-assessment.md](../feasibility/feasibility-assessment.md) / [constraint-register.md](../feasibility/constraint-register.md)

## In Scope（初期リリースに含む）

### Minimum Viable Outcome（「できた」の定義）

**S-docs-1:** 拡張内で **en / ja を同じ目次・同じスタイルで切り替え**て公式相当（guide+reference）を読める。ja は全ページ完備でなくてよい（Q1 = B）。

### Must（初期リリース必須）

| ID | 能力 | 出典 |
|----|------|------|
| M1 | 公式 docs（`docs/guide/` + `docs/reference/`）の **en 同梱・オフライン閲覧** | Q2 = A |
| M2 | **en/ja 言語切替**（同一 TOC／スタイル）— S-docs-1 | Q2 = B / Q1 = B |
| M3 | **翻訳・承認は手動別 PR** で `ja` を更新する運用（継続） | Q2 = D / intent |
| M4 | **dashboard / StageCard からの深リンク** | Q2 = E / feasibility Q1 = C |
| M5 | **upstream スナップショット取り込み**を最初の Unit／最初の作業に含める（I1 解消） | Q4 = A |
| M6 | 本文の正本は同梱二言語サイト。**既存抜粋 UI は初期から縮退／誘導** | Q5 = A |

### Bootstrap 特記（このセッション）

Q3 の注記どおり: **継続的な機械翻訳の自動同梱・自動公開は Out** だが、**初期 ja ドキュメントは AI 翻訳でこのセッション中に導入してよい**。以降の追従は M3（人手承認 PR）に戻る。

### Should（初期に望ましいが切り下げ可）

| ID | 能力 | 出典 |
|----|------|------|
| S1 | upstream **差分レポート自動化**（翻訳 PR 運用の入口） | Q2 で Must 未選択 / Q1 MVP にも未含有。Q6 = B で S-docs-1 の直後に回す |
| S2 | `bridge-map` をナビ／用語の補助として残す | Q2 で Must 未選択。本文は M6 で置換済み前提の補助 |

### Could（余裕があれば）

| ID | 能力 |
|----|------|
| C1 | harness-engineering 等、guide/reference 外ツリーの同梱 |
| C2 | ja 全ページ完備（MVP は部分 ja で可） |

## Out of Scope（初期）

| ID | 内容 | 出典 |
|----|------|------|
| O1 | 機械翻訳の **自動同梱・自動公開**（継続パイプライン） | Q3 = B（ブートストラップ AI 翻訳は上記特記） |
| O2 | 社内向け別ドキュメントサイト／CMS | Q3 = C / intent トリガー |
| O3 | クラウド／AWS 上の docs ホスティング | Q3 = E / C-T1 |
| O4 | aidlc-workflows **エンジン／ステージ定義の変更** | project Forbidden / intent（Q3 再選択なしでも継承） |
| O5 | 初期の harness-engineering 等フル公式ツリー | intent Q5 = B（guide+reference のみ） |

## Boundaries（境界）

- **コンテンツ:** en は upstream スナップショット。ja は人間承認後にのみ継続更新（初期のみ AI 翻訳導入可）
- **実行時:** ネットワーク fetch なし。更新はリポジトリ／拡張リリース単位（constraint C-T1）
- **統合面:** `vscode-extension` + `dashboard` 深リンクが第一（feasibility Q1 = A,C）
- **Docs Bridge:** 本文抜粋は同梱サイトへ誘導。正本は同梱サイト（Q5 = A）

## Sequencing（並べ方）

**価値優先**（Q6 = B）しつつ、I1 は Must 前提（Q4 = A）:

1. **M5** スナップショット取り込み（空コンテンツを防ぐ）  
2. **M1 + M2** 同梱閲覧と en/ja 切替（S-docs-1 = MVP Done）  
3. **M4 + M6** 深リンクと Bridge 縮退／誘導  
4. **M3** 運用としての翻訳 PR フロー（初期 ja はセッション内 AI 翻訳でブートストラップ可）  
5. **S1** 差分レポート自動化（Should — MVP 直後）

## Deadlines

ハードデッドラインなし（Q7 = A）。品質と運用可能性を優先。

## Traceability

| 上流 | 本スコープでの扱い |
|------|-------------------|
| intent S-docs-1 | MVP Done = Q1 = B |
| intent 同梱 guide+reference | M1 |
| intent 差分レポート + 別 PR | S1（Should）+ M3（Must 運用） |
| intent Docs Bridge 置き換え | M6 |
| feasibility I1 / R1 | M5 |
| constraint C-T1〜C-T6 | Boundaries に継承 |
