# Rough Mockups — 質問ファイル

> ステージ: rough-mockups (Ideation 1.6) / 深度: Standard  
> Intent: `260730-docs-i18n`  
> 入力: intent-statement / scope-document / intent-backlog  
> 対象 UI: 拡張内蔵 docs サイト（en/ja）・言語切替・dashboard 深リンク・Bridge 縮退  
> 各質問の `[Answer]:` に選択肢の文字（複数可の場合はカンマ区切り）または自由記述を記入してください。

---

## Q1. 主なエントリポイント

ユーザーが同梱 docs に入る主な入口はどれですか？（複数可）

- A. 拡張の専用 Docs ビュー／コマンド（コマンドパレット含む）
- B. Dashboard / StageCard からの深リンク（現在ステージ関連 docs へ）
- C. 旧 Docs Bridge 抜粋 UI からの誘導（縮退後のリンク）
- D. A と B が主、C は補助
- X. その他（具体的に記入）

[Answer]: A,B

## Q2. コアのハッピーパス

最初にワイヤーで描く中心フローはどれですか？

- A. 開く → TOC でページ選択 → 読む → en/ja 切替 → 同じ位置で読み続ける
- B. StageCard → 深リンク着地 → 読む → 必要なら言語切替 → ワークフローに戻る
- C. A を主フロー、B を副フローとして両方描く
- X. その他（具体的に記入）

[Answer]: C

## Q3. 情報階層（画面構成）

Docs ビューの情報階層の好みは？

- A. 左 TOC（目次）+ 右本文 + 上部に言語切替／版情報
- B. 上部タブ／セグメントで言語、本文は単一カラム、TOC は折りたたみ
- C. 既存 Dashboard / 拡張のレイアウト語彙に寄せ、docs 専用の新しいシェルは最小限
- X. その他（具体的に記入）

[Answer]: A

## Q4. 既存 UI パターン

従うデザイン前提は？

- A. 既存 AIDLC Guide 拡張／Dashboard の見た目・コンポーネントを踏襲（新規デザインシステムなし）
- B. 公式 docs サイトに近い読書体験を優先し、拡張シェルは薄い枠だけ
- C. A をベースに、本文エリアだけ docs らしいタイポ／余白にする
- X. その他（具体的に記入）

[Answer]: A

## Q5. デバイス／フォームファクタ

初期対応の表示面は？

- A. VS Code / Cursor 拡張 Webview のみ（デスクトップ）
- B. A + ブラウザ副経路の Dashboard（既存どおり）
- C. モバイルも考慮（初期は非対応でよいがレイアウトは崩れにくく）
- X. その他（具体的に記入）

[Answer]: A "このアプリはVSCode拡張のみが対象でブラウザなどは不要"

## Q6. アクセシビリティ

初期で満たす a11y の水準は？

- A. 既存拡張と同水準（キーボード操作・見出し・ランドマーク）。WCAG 2.1 AA を目標に後段で詰める
- B. 初期から WCAG 2.1 AA を明示必須（色非依存・フォーカス可視・スクリーンリーダー）
- C. 最低限：言語切替と TOC／本文がキーボードだけで辿れること
- X. その他（具体的に記入）

[Answer]: A

## Q7. 言語切替の挙動

切替時に守りたい体験は？

- A. 同一ページ／可能な限り同一見出しアンカーを維持して locale だけ変わる
- B. いつも TOC トップに戻ってよい（実装単純優先）
- C. ja 未訳ページは en を表示し、未訳であることが分かる表示を出す
- D. A と C の組み合わせ
- X. その他（具体的に記入）

[Answer]: A

---

## Q8. Learnings (§13) — keep as project practices?

どれを `project.md` に残しますか？（複数可）

- A. c1 — rough-mockups は拡張内蔵 docs + 深リンク + Bridge 縮退に限定
- B. c2 — Q5「ブラウザ不要」+ Q1=B は拡張内 Dashboard Webview 深リンクと解釈
- C. c3 — 未訳ページは en 本文 + 可視 notice（locale=ja のまま）に固定
- D. None — いずれも残さない
- X. その他（具体的に記入）

[Answer]: B

## Q9. Anything to add for next time?

- A. Nothing to add
- B. Add a note（具体的に記入）
- X. その他（具体的に記入）

[Answer]: A
