# Rough Mockups — 質問ファイル

> ステージ: rough-mockups (Ideation 1.6) / 深度: Standard  
> Intent: `260802-docs-bridge`（docs-i18n **Bolt 4** / Issue [#30](https://github.com/otomatty/aidlc-guide/issues/30)）  
> 上流: [intent-statement.md](../intent-capture/intent-statement.md) / [scope-document.md](../scope-definition/scope-document.md) / [intent-backlog.md](../scope-definition/intent-backlog.md)  
> Bolt 4 は Legacy Bridge の degrade（US-06）。新規画面体系は作らず、既存 Bridge / Docs Shell の差分 UX を固定します。  
> 各質問の `[Answer]:` に選択肢の文字または自由記述を記入してください。  
> **Mode:** Guide Me（推奨適用）

---

## Q1. 主要なユーザー入口

Bolt 4 でユーザーが最初に触れる画面はどれですか？

- A. Legacy Bridge パネル（ステージ／用語の旧 docs 導線）
- B. Docs Shell（Open in Docs 着地後）
- C. A → B の連続（Bridge から Shell へ）
- X. その他（具体的に記入）

[Answer]: C

## Q2. コアユーザーフロー（happy path）

Bolt 4 の主フローはどれですか？

- A. Legacy Bridge → **Open in Docs**（primary CTA）→ `openOfficialDoc` → Docs Shell
- B. Legacy Bridge 上で excerpt を記事のように読む（現状の正本体験）
- C. A を Must、B は禁止（excerpt 非マウント）
- X. その他（具体的に記入）

[Answer]: C

## Q3. Bridge 上の情報階層

degrade 後の Bridge パネルの優先順位はどれですか？

- A. 1) Open in Docs（primary） 2) 短い説明／導線文言 3) glossary 等の補助（Should）
- B. 1) excerpt 本文 2) Open in Docs は二次
- C. Open in Docs のみ（文言・補助なし）
- X. その他（具体的に記入）

[Answer]: A

## Q4. 既存デザインシステム

Bolt 4 の UI は既存 AIDLC Guide 拡張の見た目を踏襲しますか？

- A. はい（Legacy Bridge / Docs Shell を延長。新規デザインシステムなし）
- B. いいえ（新規コンポーネント体系を導入）
- X. その他（具体的に記入）

[Answer]: A

## Q5. デバイス・フォームファクタ

対象はどれですか？

- A. VS Code / Cursor 拡張 Webview のみ（親 intent と同じ）
- B. ブラウザ Dashboard も含む
- X. その他（具体的に記入）

[Answer]: A

## Q6. アクセシビリティ要件

Bolt 4 で追加／確認する a11y 要件はどれですか？（select all that apply）

- A. Open in Docs が明確なテキストの primary CTA（色だけに依存しない）
- B. 着地後は Docs Shell の既存フォーカス／アンカー契約を再利用（Bolt 3）
- C. excerpt を記事本文としてマウントしない（スクリーンリーダーが正本と誤認しない）
- D. 外部ブラウザを開かない（コンテキスト維持）
- E. 上記すべて
- X. その他（具体的に記入）

[Answer]: E

## Q7. US-09 glossary / 補助

Should の補助 UI はどう扱いますか？

- A. 残してもよいが Must ワイヤーの失敗条件にしない（切下げ可）
- B. 本 rough mockups で必須画面として描く
- C. 完全削除を Must にする
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary

| Q | Answer | Decision |
|---|--------|----------|
| Q1 | C | Bridge → Shell 連続 |
| Q2 | C | Open in Docs happy path + excerpt 非マウント |
| Q3 | A | CTA → 説明 → 補助(Should) |
| Q4 | A | 既存 DS 延長 |
| Q5 | A | 拡張 Webview のみ |
| Q6 | E | a11y 一式 |
| Q7 | A | US-09 は切下げ可 |

Looks correct / Request changes?

- Looks correct
- Request changes

[Answer]: Looks correct
