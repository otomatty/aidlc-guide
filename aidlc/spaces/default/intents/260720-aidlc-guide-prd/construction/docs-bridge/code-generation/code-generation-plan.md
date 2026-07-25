# Code Generation Plan — Unit: docs-bridge

> code-generation (3.5) / Unit: docs-bridge (kind: library, S) / 2026-07-25
> 入力: functional-design 3文書（D1〜D4 / BR-DB-1〜6）+ nfr-requirements 5文書
> （P-DB / S-DB / SC-DB / R-DB / tech-stack）+ nfr-design 5文書
> （特に logical-components.md）+ team.md / project.md
> トレーサビリティ: US-23（対応表の単一所有・cross-consumer 整合）/ US-03（ステージ
> 解説の4フィールド + deep-link + データ検証）/ US-04（用語解説）/ FR-5.1〜5.3

## 方針

nfr-design/logical-components.md のモジュール表を**そのまま**ファイル構成にする
（data/bridge-map.json + config.ts + resolve.ts + excerpt.ts + links.ts + index.ts）。
追加モジュールは作らない。config は `createBridge` だけが保持し、`resolve.ts` /
`links.ts` は引数で受ける純関数に留める（依存方向: index → {config, resolve, links}、
resolve → {data, excerpt}。逆流なし）。

## チェックリスト

### A. データ（BR-DB-1 / BR-DB-4）

- [x] `data/bridge-map.json` を単一ソースとして作成（stages + terms 同居）
- [x] `sourceVersion` を実測値で埋める（`aidlc 2.5.0 (State Version 7)` —
      `bun .claude/tools/aidlc-utility.ts version` + state-template.md の State Version 7）
- [x] 全 32 ステージのエントリを作成。`inputs`/`outputs`/`agent` は
      `.claude/aidlc-common/stages/**/*.md` の frontmatter（consumes / produces /
      lead_agent）から機械的に転記し、人名は SKILL.md の Stage Graph 表に合わせる
- [x] `purpose`（1〜2文・平易な日本語）と `gateRequirement`（ゲートで人間が
      何を求められるか）を 32 件手書き（US-03 ①④）
- [x] `docPath` / `docAnchor` を実在ファイル + 実在見出しに向ける（US-03 ⑤）
- [x] `terms` を 9 件作成: Bolt / gate / unit of work / walking skeleton / scope /
      depth / intent / space / State Version（US-04）

### B. 実装（logical-components.md のモジュール表どおり）

- [x] `src/excerpt.ts` — GitHub 形式 anchor 正規化 + 見出しスライス
      （同レベル以浅の見出しで打ち切り、コードフェンス内の `#` は見出し扱いしない）
- [x] `src/excerpt.ts` — `docsRepoPath` 配下への封じ込め（S-DB-2）
- [x] `src/util/guard-path.ts` / `src/util/with-result.ts` — reader-core の
      アルゴリズムを docs-bridge 内に**複製**（security-design.md S-DB-2 の既定）。
      `@aidlc-guide/reader-core` へのパッケージ依存は持たない（依存は型契約のみ、
      unit-of-work-dependency.md の DAG どおり／ランタイム依存ゼロを維持）
- [x] `src/config.ts` — D1 loadConfig（既定探索 / 不在→既定値 / 不正→
      `config-invalid` / docsRepoPath 不在→ `{ok}` + warning）
- [x] `src/resolve.ts` — D2/D3。`bridge-map.json` の静的 import（R-DB-1 のビルド時
      防衛）+ `Object.freeze`（R-DB-3）+ `resolveStage(config, slug)` /
      `resolveTerm(config, term)` の純関数シグネチャ
- [x] `src/links.ts` — D4 `projectLinks(config)`
- [x] `src/index.ts` — `createBridge(configPath?)` が loadConfig を1回だけ実行し、
      公開4メソッド（getConfig / resolveStage / resolveTerm / projectLinks）へ
      config を内部で渡す。全メソッド `withResult` 包み（R-DB-1 throw ゼロ）
- [x] `shared-types` に `BridgeConfig` / `ProjectLink` / `DeepLink` / `StageDoc` /
      `TermDoc` を追加（domain-entities.md「型定義（shared-types に追加）」）

### C. テスト（domain-entities.md「ライフサイクル / テスト境界」）

- [x] resolve: 既知/未知 slug、既知/未知 term、docs 有、docs 無、節欠落
- [x] config: 省略（cwd 探索）、不在、不正 JSON、非オブジェクト、型不正、
      ディレクトリ、docsRepoPath 不在（warning 経路）、相対パス解決、
      projectLinks の不正要素
- [x] excerpt: 同レベル見出し境界での切り出し、より浅い見出しでの打ち切り、
      フェンス内 `#` の無視、anchor 正規化（大小文字・先頭 `#`・`&` の二重ハイフン・
      非 ASCII）、docs ルート外パスの拒否（相対・絶対の両方）
- [x] guardPath 共通テストベクタ（S-DB-2 の等価性担保）:
      `docs-bridge/tests/vectors/guard-path-vectors.ts` の1つの表を
      docs-bridge・reader-core の**両実装**に対して実行し、複製間の drift を
      テスト失敗として検出する
- [x] data-lint（US-03 AC ⑤ / R-DB-4）: bridge-map.json の全 docPath/docAnchor が
      実ツリーに解決すること + docPath が当該 slug の stage ファイルを指していること。
      ツリー不在時は `describe.skipIf` + 警告
- [x] cross-consumer 決定性（US-23 AC 単体版）: 同一 slug 2回 → 同一値、
      別 config を持つ2消費者 → 同一値、map が frozen であること
- [x] facade: config 未設定でも動く、config warning が全メソッドに伝播、
      config 不正が全メソッドで `config-invalid`、loadConfig は1回のみ

### D. 品質ゲート（team.md）

- [x] Biome の read-only restricted-imports override を `packages/docs-bridge/src/**`
      へ拡張（S-DB-1）
- [x] `bun run check`（biome + tsc --noEmit + vitest --coverage + bun audit）green
- [x] ランタイム第三者依存ゼロ（tech-stack-decisions.md）

## 承認

実装計画は本ファイルの内容で確定。実行結果は `code-summary.md` を参照。
