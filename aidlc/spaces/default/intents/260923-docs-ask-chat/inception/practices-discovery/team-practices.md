# Team Practices（統合）

> Practices Discovery Step 5 統合。インタビュー回答とサポート貢献を反映済み。肯定ゲート前のため `team.md` / `project.md` は未更新。

## Way of Working

Trunk-based development を継続する。すべての作業は `main` から切った短命な feature/Bolt ブランチで行い、`main` へ squash-merge する。Construction の worktree ベース／マージ先はどちらも `main`。

コンテンツ作業（upstream スナップショット、ja 翻訳 PR、docs-qa / Docs UI の変更）も同じ trunk 上の短命ブランチで行う。locale 専用や機能専用の長寿命ブランチは作らない。

## Walking Skeleton

Walking Skeleton のセレモニーは行わない。最初の実装も通常の作業として進める。スコープは `skeleton: off` のままとし、別スコープが明示しない限り骨格用の単独 Bolt・ソロゲート・ラダープロンプトは起動しない。

## Testing Posture

- **Methodology**: tdd
- **Ordering**: 先に失敗するテストを書き、それから実装する。
- テストランナーは **Vitest**。ローカル品質ゲートは単一の `bun run check`。
- ワークスペース全体に classic の **line coverage 80%** 床を適用する。既存の **branch coverage 95%** 床（`reader-core` parse および選定 `official-docs` パス）は現行対象のまま残す。
- docs-qa 向けに **branch coverage 70%** 以上の床を新設する。これは既存 95% 床の置換ではなく加算である。
- 拡張ホスト経由の bundled docs 読込について、locale コンテンツルート + `guardPath` の否定テストを `bun run check` 対象に含める。
- チャット画面化の UI テストと契約テストは `bun run check` の必須項目とする（欠落した変更は通さない）。
- 先行肯定の US-06（StageCard/Bridge で excerpt が記事としてマウントされないこと、および primary CTA が `open-official-doc` を叩くこと）の UI/契約テストも `bun run check` に含め続ける。
- 画面側とサーバ側の質問履歴上限は本変更で揃える。共有する具体数値は未確定のため、実装前に別途決める。
- VSIX サイズの数値ゲートは当面設けない。

## Deployment

本プロジェクトはローカル専用。クラウド／ステージング／CD なし。「リリース」= `main` への squash-merge または git タグ。ロールバック = `git revert` / 直前タグ。

実行時 fetch やクラウド docs ホスティングは行わない。VSIX に秘密情報・`.env`・`aidlc/` ランタイム状態を出荷しない。

AppSec の制御面は oxlint・型検査・`guardPath` 否定テスト・パッケージ衛生・`bun audit` に集約する。専用クラウド SAST／DAST、および gitleaks 等の専用 secret scanner はゲート外とし、本 intent では Mandated 化しない。

## Code Style

Lint は oxlint（`.oxlintrc.json`、dashboard は `@shadcn/lint` プラグイン含む）、format は oxfmt（`.oxfmtrc.json`、Prettier 互換）。org.md の「Formatter: Prettier」既定はこの team 設定で上書きし、Biome / Prettier はリポジトリでもエディタでも使わない。LF、言語慣習の命名、クロスプラットフォームパス。reader-core の UI 非依存・パーサ隔離・Result 境界は継承する。docs-qa のワイヤ／API 境界では `DocsQaResult<T>`（または同等の明示的失敗表現）を崩さない。チャット画面化は既存の `api-core` ハンドラ分割・`ai-cli` 隔離・dashboard `features/docs` 配置を踏襲し、並行 DTO や新ドメイン読込パスを増やさない。

| 項目 | 決定 |
|------|------|
| Locale コード | `en` / `ja` |
| 同梱ツリー | `docs/guide/<locale>/...` と `docs/reference/<locale>/...` |
| API | `/api/official-docs/:locale/*` |
| コンテンツローダ | `api-core` / `official-docs`（`reader-core` / `dashboard` には置かない） |
| Bridge CTA | 既存 `open-official-doc` を再利用（並行着地口を増やさない） |
| 本文の言語切替 | コンテンツツリー切替。i18n メッセージカタログ枠組みは導入しない |
