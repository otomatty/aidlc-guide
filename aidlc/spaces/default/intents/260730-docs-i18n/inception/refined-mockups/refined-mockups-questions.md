# Refined Mockups — 計画質問

> ステージ: refined-mockups (Inception 2.5) / Intent: `260730-docs-i18n`  
> 入力: wireframes · user-flow · stories · requirements · team-practices  
> 推奨値で自動記入（ユーザー指示パターン 2026-07-31）

---

## Q1. ストーリー ↔ 画面マッピング

各 Must UI ストーリーの主表現は？

- A. US-02→W1 / US-03+US-04→W2 状態 / US-05→W3+W5 / US-06→W4（U5 運用は画面なし）
- B. ストーリーごとに新規画面を起こす（W1–W5 を捨てる）
- C. Docs Shell 1 画面にすべて畳む（Dashboard 差分も Shell 内）
- X. その他

[Answer]: A

## Q2. インタラクションパターン

locale・深リンク・Bridge に使うパターンは？

- A. インラインのみ（locale は header コントロール、深リンクは着地スクロール、Bridge は primary CTA）。モーダル／ウィザードなし
- B. locale 切替を確認ダイアログ付きにする
- C. Bridge をフルスクリーン wizard にする
- X. その他

[Answer]: A

## Q3. 画面状態セット

Docs Shell が扱う状態は？

- A. loading / empty（スナップショット未） / error（読込失敗・path reject） / ready / partial（未訳 notice）
- B. ready のみ（他は後段）
- C. A + offline-banner 専用（公式 fetch 失敗 UI）— NFR-1 により不要寄り
- X. その他

[Answer]: A

## Q4. デザインシステム整合

- A. 既存 AIDLC Guide Webview + VS Code theme tokens を踏襲（rough Q4=A 継続）。新規 DS なし
- B. 公式 docs サイト風の独自テーマを導入
- C. shadcn 既定のまま拡張テーマを無視
- X. その他

[Answer]: A

## Q5. アクセシビリティ目標

- A. NFR-7 Should をチェックリスト化（キーボード TOC↔本文、landmarks、locale 可視ラベル）。WCAG 2.1 AA 完全適合は後段
- B. 今ステージで WCAG 2.1 AA 完全適合を Must にする
- C. a11y は Construction まで一切触れない
- X. その他

[Answer]: A

## Q6. レスポンシブ／パネル幅

- A. 拡張 Webview 前提: 狭幅で TOC 折りたたみ（またはオーバーレイ）、広幅で W1 2 ペイン。モバイル Web ブレークポイントは対象外
- B. モバイルファーストの 3 ブレークポイントを定義
- C. 固定幅のみ（折りたたみなし）
- X. その他

[Answer]: A
