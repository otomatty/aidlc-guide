# Functional Design 質問 — Unit: reader-core

> functional-design (3.1) / Unit: reader-core (kind: library, L) / 2026-07-23
> 入力: unit-of-work.md U1 + story-map（US-09a/15）+ requirements.md FR-1 + components.md C2 + component-methods.md（Reader API 表）+ services.md

## 質問なし（Construction の質問は例外運用）

reader-core の設計判断は上流 + 実データ観測で確定済み:

- 公開 API（createReader ファサード・ReadResult・7メソッド）→ component-methods.md で確定
- パース対象の実文法 → 本ワークスペースの実 `aidlc-state.md`（State Version 7）と記録ディレクトリ構造を直接観測して規則化（business-rules.md に記載）
- 5失敗モードの縮退 → US-15 AC で確定
- watch の対象・通知 → FR-1.5 + application-design（debounce・ディレクトリ粒度）

[Answer]: N/A（質問なし — 実データ観測に基づく文法規則を business-rules.md に固定。genuine gap なし）
