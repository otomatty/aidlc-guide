# Functional Design 質問 — Unit: reader-core

> functional-design (3.1) / Unit: reader-core (kind: library, L) / 2026-07-23
> 入力: unit-of-work.md U1 + story-map（US-09a/15）+ requirements.md FR-1 + components.md C2 + component-methods.md（Reader API 表）+ services.md

## 質問なし（Construction の質問は例外運用）

reader-core の設計判断は上流 + 実データ観測で確定済み:

- 公開 API（createReader ファサード・ReadResult・7メソッド）→ component-methods.md で確定
- パース対象の実文法 → 当初は本ワークスペースの実 `aidlc-state.md`（当時 State Version 7）を観測して規則化。サポート対象は 2026-08-14 に State Version 8 / 2.6.2 へ再適用（business-rules.md G-2）
- 5失敗モードの縮退 → US-15 AC で確定
- watch の対象・通知 → FR-1.5 + application-design（debounce・ディレクトリ粒度）

[Answer]: N/A（質問なし — 実データ観測に基づく文法規則を business-rules.md に固定。genuine gap なし）
