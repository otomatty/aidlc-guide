# Rough Mockups — 質問ファイル

> ステージ: rough-mockups (Ideation 1.6) / 深度: Standard  
> Intent: `260802-docs-deeplink`（docs-i18n **Bolt 3**）  
> 親: Bolt 1/2 完了。追跡 Issue [#29](https://github.com/otomatty/aidlc-guide/issues/29)  
> 回答モード: Chat — 推奨を適用（ユーザー指示 2026-08-02）

---

## Q1. 主要なユーザー入口

Bolt 3 でユーザーが最初に触れる画面はどれですか？

- A. StageCard の docs リンク（ラベル付き）
- B. Docs Shell（深リンク着地後）
- C. A → B の連続（カードから Shell へ）
- X. その他（具体的に記入）

[Answer]: C

## Q2. コアユーザーフロー（happy path）

Bolt 3 の主フローはどれですか？

- A. マップ済みステージ: StageCard リンク → openOfficialDoc → Docs Shell（path/anchor/locale）
- B. 未マップ: StageCard リンク → Docs Shell top
- C. A と B の両方（マップ／未マップ分岐）
- X. その他（具体的に記入）

[Answer]: C

## Q3. リンクラベル

StageCard の docs リンク文言はどれが適切ですか？

- A. bare `Docs` のみ
- B. `Docs: <Stage 表示名>` などステージが分かる文言（bare `Docs` 禁止）
- C. アイコンのみ（テキストなし）
- X. その他（具体的に記入）

[Answer]: B

## Q4. 既存デザインシステム

Bolt 3 の UI は既存 AIDLC Guide 拡張の見た目を踏襲しますか？

- A. はい（StageCard / Docs Shell を延長。新規デザインシステムなし）
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

Bolt 3 で追加する a11y 要件はどれですか？（select all that apply）

- A. リンクは明確なテキスト（bare `Docs` 禁止）
- B. Docs Shell 着地後、`anchor` があれば見出しへフォーカス／スクロール
- C. 外部ブラウザを開かない（コンテキスト維持）
- D. 色だけに依存しない（既存三重表現を継承）
- E. 上記すべて
- X. その他（具体的に記入）

[Answer]: E

## Q7. レガシー docs リンク

既存の `docsOpenHref` / IDE open はどう扱いますか？

- A. マップ済み経路では openOfficialDoc に置き換え（外部ブラウザを出さない）
- B. レガシーを残し、新リンクを併置
- C. A（置き換えが Must）
- X. その他（具体的に記入）

[Answer]: C
