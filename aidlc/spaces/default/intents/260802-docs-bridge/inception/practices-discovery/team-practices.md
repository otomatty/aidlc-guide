# Team Practices — Docs i18n Bolt 4

> Stage: practices-discovery (Inception) · Intent: `260802-docs-bridge` · Scope: feature  
> Status: **INTEGRATED — pending affirmation gate**  
> Baseline: `aidlc/spaces/default/memory/team.md`（Q1 = A 継承）  
> Interview: 2026-08-03 · Scan HEAD: `ee2fc24`

---

## Way of Working

Trunk-based development を継続する。すべての作業は `main` から切った短命な feature/Bolt ブランチで行い、`main` へ squash-merge する。Construction の worktree ベース／マージ先はどちらも `main`。

docs-i18n のコンテンツ作業（upstream スナップショット、ja 翻訳 PR）も同じ trunk 上の短命ブランチで行う。locale 専用の長寿命ブランチは作らない。

---

## Walking Skeleton

docs-i18n 専用の新しい skeleton 定義は作らない。`team.md` の Walking Skeleton 既定（Bolt 1 ソロ・ゲート、人間承認後に続行、完了後ラダープロンプト）を継承する。

Bolt 4 は Walking Skeleton ではなく通常 Bolt（US-06 Bridge degrade）として進行する。

---

## Testing Posture

テストランナーは **Vitest**。ローカル品質ゲートは単一の `bun run check`。

- official-docs の **branch coverage 95%** 床は継承する。
- 拡張ホスト経由の bundled docs 読込について、locale コンテンツルート + `guardPath` の否定テストを `bun run check` 対象に含める（継承）。
- **Bolt 4 / Interview Q2 = A:** US-06 について、StageCard/Bridge で excerpt が記事としてマウントされないこと、および primary CTA が `open-official-doc` を叩くことを検証する UI/契約テストを `bun run check` に含める。

VSIX サイズの数値ゲートは当面設けない（継承）。

---

## Deployment

本プロジェクトはローカル専用。クラウド／ステージング／CD なし。「リリース」= `main` への squash-merge または git タグ。ロールバック = `git revert` / 直前タグ。

実行時 fetch やクラウド docs ホスティングは行わない。VSIX に秘密情報・`.env`・`aidlc/` ランタイム状態を出荷しない（Q3 = A）。

---

## Code Style

Biome（format+lint）、LF、言語慣習の命名、クロスプラットフォームパス。reader-core の UI 非依存・パーサ隔離・Result 境界は継承。

| 項目 | 決定 |
|------|------|
| Locale コード | `en` / `ja` |
| 同梱ツリー | `docs/guide/<locale>/...` と `docs/reference/<locale>/...` |
| API | `/api/official-docs/:locale/*` |
| コンテンツローダ | `api-core` / `official-docs`（`reader-core` / `dashboard` には置かない） |
| Bridge CTA | 既存 `open-official-doc` を再利用（並行着地口を増やさない） |
| 本文の言語切替 | コンテンツツリー切替。i18n メッセージカタログ枠組みは導入しない |
