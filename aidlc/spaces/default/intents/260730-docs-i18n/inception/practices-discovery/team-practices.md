# Team Practices — Docs i18n

> Stage: practices-discovery (Inception) · Intent: `260730-docs-i18n` · Scope: feature  
> Status: **INTEGRATED — pending affirmation gate**  
> Baseline: `aidlc/spaces/default/memory/team.md` (inherited — interview Q7 = A)  
> Interview: 2026-07-31 · Scan HEAD: `7148a19`

---

## Way of Working

Trunk-based development を継続する。すべての作業は `main` から切った短命な feature/Bolt ブランチで行い、`main` へ squash-merge する。Construction の worktree ベース／マージ先はどちらも `main`。

docs-i18n のコンテンツ作業（upstream スナップショット、ja 翻訳 PR）も同じ trunk 上の短命ブランチで行う。locale 専用の長寿命ブランチは作らない。

---

## Walking Skeleton

**Interview Q1 = C:** docs-i18n 専用の新しい skeleton 定義は作らない。`team.md` の Walking Skeleton 既定（Bolt 1 ソロ・ゲート、人間承認後に続行、完了後ラダープロンプト）を継承する。

スコープ上の先頭作業は引き続き M5（スナップショット取り込み）→ M1/M2（同梱閲覧＋言語切替）の価値順。skeleton の「薄いスライス」儀式を docs 用に再定義しない。

---

## Testing Posture

テストランナーは **Vitest**。ローカル品質ゲートは単一の `bun run check`（テスト green + カバレッジ床 + Biome + `tsc --noEmit` + 既存監査）。

**Interview Q2 = A:** 新しい **locale 解決／コンテンツ読込モジュール**は reader-core parse と同クラスとし、**branch coverage 95%** を Must とする。

**Interview Q8 = A:** 拡張ホスト経由で bundled docs を読む経路について、locale コンテンツルート + `guardPath` の**否定テスト**（意図的にルート外へ逃げるパス）を `bun run check` 対象に含める（Must）。

その他の床（UI line ~80%、tb-lxp 方針、単一ゲート）は team.md を継承。

**Interview Q3 = C:** VSIX サイズの数値ゲートは当面設けない。サイズ監視は NFR ステージまで延期（feasibility Q7 = A）。

---

## Deployment

本プロジェクトはローカル専用。クラウド／ステージング／CD なし。「リリース」= `main` への squash-merge または git タグ。ロールバック = `git revert` / 直前タグ。

docs-i18n でも実行時 fetch やクラウド docs ホスティングは行わない。同梱コンテンツの更新はリポジトリ／拡張リリース単位。

VSIX に秘密情報・`.env`・`aidlc/` ランタイム状態を出荷しない（サイズ数値ゲートは Q3=C で延期しても、内容衛生は Mandated）。

---

## Code Style

Biome（format+lint）、LF、言語慣習の命名、クロスプラットフォームパス。reader-core の UI 非依存・パーサ隔離・Result 境界は継承。

**Interview 確定:**

| 項目 | 決定 |
|------|------|
| Locale コード | `en` / `ja`（Q4 = A） |
| 同梱ツリー | `docs/guide/<locale>/...` と `docs/reference/<locale>/...`（Q5 = A） |
| API | `/api/official-docs/:locale/*`（Q6 = A） |
| コンテンツローダ配置 | `api-core`（またはその下位のドメイン兄弟）。`reader-core` / `dashboard` には置かない |
| 本文の言語切替 | コンテンツツリー切替。i18n メッセージカタログ枠組みは導入しない |

既存 `docs/guides/`（製品ガイド）および `/api/guides` とは命名・ルーティングを混同しない。
