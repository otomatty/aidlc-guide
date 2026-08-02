# Rough Mockups — 質問ファイル

> ステージ: rough-mockups (Ideation 1.6) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 親: 完了済み `260730-docs-i18n`（Bolt 1 / PR [#26](https://github.com/otomatty/aidlc-guide/pull/26)）  
> 追跡 Issue: [#28](https://github.com/otomatty/aidlc-guide/issues/28)  
> Bolt 1 で Docs Shell のワイヤーフレームは確立済み。本 intent は **locale/untranslated の UI 詳細** を固定するための質問です。  
> 各質問の `[Answer]:` に選択肢の文字または自由記述を記入してください。

---

## Q1. 主要なユーザー入口

Bolt 2 でユーザーが最初に触れる画面はどれですか？

- A. Docs Shell（既存 W1）の locale 切替コントロール
- B. 未訳 notice が表示された Docs Shell
- C. A と B の両方（切替操作と結果表示）
- X. その他（具体的に記入）

[Answer]: C

## Q2. コアユーザーフロー（happy path）

Bolt 2 の主フローはどれですか？

- A. 親 intent の Flow A（Browse & switch locale）を部分 `ja` 対応に拡張
- B. 新規フロー（未訳ページ専用）を追加
- C. A のみ（新規フローは不要）
- X. その他（具体的に記入）

[Answer]: C

## Q3. 情報階層

未訳 notice の配置はどれが適切ですか？

- A. 本文（`main`）の先頭、`role=status` でスクリーンリーダーに伝える
- B. ヘッダー（`header`）にバナーとして表示
- C. TOC（`nav`）に未訳マークを表示
- D. A + C（本文 notice が必須、TOC マークは任意）
- X. その他（具体的に記入）

[Answer]: D

## Q4. 既存デザインシステム

Bolt 2 の UI は既存 AIDLC Guide 拡張の見た目を踏襲しますか？

- A. はい（新規デザインシステムなし）
- B. いいえ（新規コンポーネントを導入）
- X. その他（具体的に記入）

[Answer]: A

## Q5. デバイス・フォームファクタ

対象はどれですか？

- A. VS Code / Cursor 拡張 Webview のみ（親 intent と同じ）
- B. ブラウザ Dashboard も含む
- X. その他（具体的に記入）

[Answer]: A

## Q6. アクセシビリティ要件

Bolt 2 で追加する a11y 要件はどれですか？（select all that apply）

- A. 未訳 notice は `role=status`（または同等の live 領域）
- B. locale 切替後フォーカスは本文見出し付近に維持
- C. 現在 locale を `aria-current` / 可視ラベルで示す
- D. 色だけに依存しない（色+記号+ラベル）
- E. 上記すべて
- X. その他（具体的に記入）

[Answer]: E

## Q7. 未訳時の locale 維持

`ja` 欠落ページで locale を `ja` のまま維持する実装方針はどれですか？

- A. URL / 状態管理で locale を保持し、コンテンツのみ en を表示
- B. locale を `en` にフォールバックし、notice で「英語を表示中」と伝える
- C. A（親 intent の W2 設計を継承）
- X. その他（具体的に記入）

[Answer]: C
