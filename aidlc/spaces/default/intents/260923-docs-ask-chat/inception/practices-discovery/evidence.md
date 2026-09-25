# Practices Discovery Evidence（統合）

> Brownfield 再実行。リード草稿・三サポート貢献・六問インタビューを統合した結果。

## Participants and What They Inspected

### Lead（aidlc-pipeline-deploy-agent）

- 方法層 `org.md` / `team.md` / `project.md`、`phases/inception.md`、intent 状態。
- CodeKB 六本、`package.json` の `check`、`.github/workflows/check.yml`、スコープ `classic`（`skeleton: off`）、HEAD `1702755bcfa54e25ffa99afcce25d834efad23d9`。
- 推論: trunk + squash、local-only、Vitest + 単一 `check`、oxlint/oxfmt はベースライン維持。Methodology は当初 test-after 草案だったがインタビューで上書き。

### aidlc-quality-agent

- Testing Posture・CI 鏡像・docs-qa 関連テスト配置・履歴上限ずれを評価。
- AGREE: 単一 `check`、Vitest、official-docs branch 95%、`guardPath` 否定、VSIX サイズ無ゲート。
- OBJECT（面接前）: Methodology の先走り確定、UI/契約の Mandated 未決、履歴差の放置、classic 80% の対象曖昧さ。

### aidlc-developer-agent

- 命名・レイヤ・配置・Code Style を CodeKB / `team.md` と突合。
- AGREE: 境界・スタイル・Forbidden の中核、硬規則の新規発明抑制。
- OBJECT: US-06 義務の軟化禁止、`DocsQaResult` / `features/docs` 踏襲の明記、Walking Skeleton 差分の肯定明示。

### aidlc-devsecops-agent

- lint/format・供給鎖・秘密衛生・SAST/DAST 範囲を評価。
- AGREE: oxlint/oxfmt、`bun audit`、ロックファイル、VSIX 衛生、専用 SAST/DAST/secret scanner の新 Mandated なし。
- OBJECT: loopback bind + `--host` 警告の Mandated 再掲脱落防止、専用 SAST/DAST・secret scanner を沈黙ギャップにしない。

## Interview Decisions（六問）

1. **Methodology**: `tdd`。**Ordering**: 先に失敗するテストを書き、それから実装する。
2. **docs-qa coverage 床**: branch 70% 以上を新設。既存 95% branch 床は現行パスで維持（置換しない）。
3. **チャット UI/契約テスト**: Mandated — ALWAYS `bun run check` に含め、欠落変更は通さない。
4. **履歴上限**: 画面とサーバを本変更で揃える。共有する具体数値は人間が未指定のため未確定（3 でも 8 でもない値を発明しない）。
5. **classic 80% line 床**: ワークスペース全体に適用。既存 95% branch 床は現行パスで維持。
6. **Walking Skeleton**: セレモニーなし。最初の実装は通常作業。スコープは `skeleton: off` のまま。

## Unresolved

- **質問履歴の共有上限値**: 揃えることは決定済みだが、画面（完了 3 件・6000 字）とサーバ（history 8）のどちらに寄せるか、または別の共有数にするかは未決。実装・契約テストの期待値を固定する前に人間が数値を決める必要がある。
