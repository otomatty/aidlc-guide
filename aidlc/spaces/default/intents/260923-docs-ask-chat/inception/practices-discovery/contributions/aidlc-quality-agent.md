**Collaborator:** aidlc-quality-agent

## Contribution

品質観点で草稿・CodeKB・`team.md` を突合した結果。単一ゲート（`bun run check`）、Vitest、official-docs の **branch 95%**、`guardPath` 否定テスト、VSIX サイズ無ゲート、CI が `check` の鏡像である点は証拠と一致し、採用してよい。本 intent（docs-ask-chat / チャット画面化）向けの未決はテスト不足の有無より、**姿勢の明示・カバレッジ床の範囲・UI/契約テストの強制強度・履歴契約の揃え方**にある。

### Testing Posture（現状評価）

| 項目 | 観測 | 品質判断 |
|------|------|----------|
| Methodology | `team.md` に Methodology 欄なし。実装後 Vitest 追加が観測され、TDD/BDD 強制の痕跡なし → 草稿は org 既定どおり **test-after** | 運用実態としては妥当。ただしチャット UI 変更で TDD/BDD へ上げるかは**インタビュー必須**（evidence Uncertain と一致） |
| Ordering | 適用層を実装してからその層のテストを書く | test-after と整合。肯定時は Methodology とセットで文言固定すること |
| Runner / Gate | Vitest + 単一入口 `bun run check`（lint / format:check / typecheck / docs-index / workflows-compatibility / test:coverage / audit-shards / audit） | Mandated「呼び出し側はチェックを独自列挙しない」と CI 鏡像は維持必須 |
| Coverage | `reader-core` parse と選定 `official-docs` に branch 95%。**docs-qa 専用床は未設定** | 回帰は既存関連テストの存在に依存。チャット画面化で触る経路を床なしのままにするか、パッケージ／パス床を新設するか面接で決める |
| 継承義務 | locale ルート + `guardPath` 否定テスト；US-06 UI/契約（StageCard/Bridge excerpt 非マウント + primary CTA → `open-official-doc`）を `check` に含む | 先行 intent の義務。本 intent で同一強度を継承するか再肯定が必要 |
| 本 intent 追記案 | docs-qa / Docs UI 回帰を緑に保ち、チャット経路に UI/契約テストを `check` へ載せる | 方向は正しい。Mandated 昇格か Testing Posture 追記かはインタビュー項目 |
| classic 加算 | org 既定の 80% line-coverage 床＋マージ前 CI | 既存のパッケージ別 branch 床と「加算」の解釈（全体 line か対象パスか）を面接で曖昧さなくする |
| VSIX サイズ | 数値ゲートなし（NFR 予算まで hard-fail 禁止） | AGREE。パフォーマンス NFR 未定義のままサイズ床を発明しない |

### CI 品質ゲート

- `.github/workflows/check.yml` が `bun run check` を鏡像し、push/PR to `main`、OS マトリクス（ubuntu/windows/macos）。クラウド CD なし → Deployment（local-only）と整合。
- 品質ゲートの定義場所を増やさない方針を支持。新規検査（チャット UI/契約、必要なら docs-qa coverage）は **必ず `check` に配線**し、workflow 側に項目列挙を戻さないこと。
- `bun audit` をゲート失敗相当にする Mandated は依存スキャンとして妥当（セキュリティテストの最小枠）。

### テスト／コードパターン（観測）

- 配置: `packages/*/tests/**/*.test.ts`（node）；dashboard は `src/**/*.test.{ts,tsx}` + `tests/**`（jsdom）；`scripts/**/*.test.ts`。
- docs-qa 関連: `api-core` の docs-qa / routes、`official-docs` の question-context、`dashboard` の `useDocsQa` / DocsPage 系が既存。バックエンド会話継続の自動テスト基盤はある。
- ギャップ信号（CodeKB）: 専用 `AppRoute` 未実装、ホーム同居 UX、**クライアント履歴（完了3・6000字）vs サーバ `history` 上限 8**。これは実装前に**契約として揃えるか後回しにするか**がテスト設計を左右する。揃えるなら契約テスト（ワイヤ型／validation／hook の三者一致）を `check` に載せるのが最小の正しい形。

### インタビューで解決すべきギャップ（優先順）

1. **Methodology**: test-after を肯定するか、チャット画面化に合わせて TDD / BDD / custom へ上げるか。
2. **docs-qa（およびチャット経路）coverage 床**: 新設するか、既存テスト緑＋経路別 UI/契約テストに留めるか。新設するなら対象パスと閾値（line / branch）を数値で決める。
3. **UI/契約テストの規則強度**: Testing Posture 追記のみか、Mandated（ALWAYS `bun run check` にチャット画面化の UI/契約テストを含む）へ昇格するか。US-06 義務の同一強度継承もここで同時に決める。
4. **履歴上限の契約**: クライアントとサーバのずれを本 intent で揃えるか Deferred か。揃える場合は受け入れ条件と契約テストの期待値を一つに固定する。
5. **classic 80% line 床の適用範囲**: ワークスペース全体か、変更パッケージ／新規パスか。既存 95% branch 床との優先・加算関係を一文で定義する。

### 草稿への品質コメント（編集はしない）

- `team-practices.md` Testing Posture の「Methodology: test-after」明示は、現状の `team.md` より前進しており肯定ゲート向き。インタビュー未了のまま Mandated に Methodology を書かないこと。
- `discovered-rules.md` の coverage / guardPath / 単一 `check` / audit 条項は証拠と一致。チャット UI テストや docs-qa 床は Uncertain のため、面接前に Forbidden/Mandated へ発明しない判断は正しい。
- CodeKB「品質ゲートと docs-qa 自動テストは存在；主なギャップは UX アーキテクチャ」に同意。ただし履歴契約のずれは**テスト可能な仕様ギャップ**として面接リストに残す。

## Positions

AGREE:
- 単一品質ゲートは `bun run check` のみ。CI・手順書はこれを呼ぶだけ。
- テストランナーは Vitest。official-docs（選定パス）branch 95% 床と `guardPath` 否定テストの継承。
- VSIX サイズの hard-fail は NFR 予算まで設けない。
- classic / local-only のため、クラウド負荷試験や CD ゲートは本スコープ外。マージ前の OS マトリクス `check` で十分。
- docs-qa 専用 coverage 床を**面接前に硬規則として発明しない**（現状未設定の事実を保つ）。

OBJECT:
- Methodology を面接なしで test-after 確定扱いし、ゲート後に動かない前提で Construction に進むこと — Uncertain のまま肯定するとチャット UI の書き順・レビュー期待がぶれる。
- 「チャット経路の UI/契約テストを `check` に載せる」を Testing Posture の願望表現のままにし、Mandated 昇格可否を面接で決めないこと — 先行 US-06 義務との強度差が再生産される。
- 履歴上限のクライアント／サーバ差を「UX の話」としてテスト対象外に落とすこと — 契約不一致は回帰バグの温床。揃える／Deferred のどちらかを明示すること。
- classic の 80% line 床を「加算」とだけ書き、対象集合を決めないこと — 既存 branch 95% と衝突解釈が起きる。
