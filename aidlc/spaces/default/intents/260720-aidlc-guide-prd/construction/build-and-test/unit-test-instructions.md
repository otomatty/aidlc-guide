# Unit Test Instructions — AIDLC Guide

> build-and-test (3.6) / Test Strategy: **Standard** / 2026-07-25
> 入力: 全9 Unit の `code-generation-plan.md` / `code-summary.md`（各 Unit のテスト構成表）+ team.md Testing Posture

## フレームワークと構成

**Vitest**（team.md Q3 で確定）。`bun test` は branch coverage を持たずパーサの検証要件を満たせないため不採用。

`vitest.config.ts` は**2プロジェクト構成**。1コマンドで両方走る:

| project | environment | 対象 | 理由 |
|---------|------------|------|------|
| `node` | node | `packages/*/tests/**/*.test.ts`（dashboard を除く） | ファイルシステム・プロセス・サーバを扱う |
| `dashboard` | jsdom | `packages/dashboard/tests/**/*.test.{ts,tsx}` | ブラウザパッケージ。`@testing-library/react` を使う |

`tests/setup.ts` は RTL の `cleanup` を `afterEach` に登録し、`asyncUtilTimeout: 5000` を設定する。既定 1000ms では、フルスイート（2プロジェクト + coverage 計装）の負荷下で実 `import()` → fetch → render を待つアサーションが約4回に1回溢れた。CI が無くこのコマンドが唯一のゲートである以上、負荷由来の赤は「再実行して緑になるまで回す」習慣を生むため許容しない。

## 実行

```bash
bun run test
```

期待される出力:

```
 Test Files  52 passed (52)
      Tests  685 passed | 2 skipped (687)
```

絞り込み:

```bash
bunx vitest run --project node                          # サーバ・ライブラリ側のみ
bunx vitest run --project dashboard                     # SPA のみ
bunx vitest run packages/reader-core/tests/parse-state.test.ts   # 単一ファイル
bunx vitest run --coverage                              # カバレッジ付き
```

**skip される2件は正常**: どちらも `skipIf` による環境条件付きスキップで、無効化されたテストではない。

- `docs-bridge/tests/data-lint.test.ts:27` — docs リポジトリが手元に無い環境で skip
- `docs-bridge/tests/vectors/guard-path-vectors.ts:134` — symlink 作成権限が無い環境（Windows で開発者モード未有効等）で skip

## Unit 別のテスト構成（実測）

| パッケージ | テストファイル | 主な検証対象 |
|-----------|-------------|------------|
| `reader-core` | 12 | State Version パーサ（G-1〜G-6）、成果物ツリー走査、監査抽出、インテント解決、watch→rebuild→notify、`guardPath` の containment、依存方向 |
| `dashboard` | 17 | store の reducer / deriveViewState、13コンポーネント、artifact-viewer 6件、mob-mode、依存方向 |
| `docs-bridge` | 7 | 対応表の data-lint、設定解決、excerpt 抽出、`guardPath` 共有ベクタ |
| `dashboard-server` | 6 | 読み取り7ハンドラ、AnswerWriter の5ゲート、WS push、静的配信、公開アドレス列挙、smoke（実プロセス） |
| `mcp-server` | 5 | 5ツールの描画、記録外パス拒否、smoke（実 stdio） |
| `btw` | 5 | 引数パース、slug 化、セッション解決、plan モード必須、help 文言 |
| `shared-types` | 0 | **型のみでランタイムコードを持たない**ため単体テスト対象外。誤りは `tsc --noEmit` が検出する |

粒度は Standard 戦略の目安（コンポーネントあたり 5〜8 テスト）に沿う。ただし**リスク中心のパーサは例外的に厚い**（下記）。

## カバレッジ目標

| 対象 | 基準 | 根拠 |
|------|------|------|
| `reader-core/src/parse/**` | **branch 95% / statement 95% / function 95% / line 95%**（`vitest.config.ts` の `thresholds` で強制。下回るとコマンドが失敗する） | team.md: State Version パーサが本プロジェクトのリスク中心。ライン数ではなく**分岐**で縛る |
| UI 層（`dashboard/src/**`） | ライン 80% 目安（強制はしない） | team.md Testing Posture |
| リポジトリ全体（実測） | Statements 96.53% / Branches 92.60% / Functions 96.78% / Lines 97.73% | — |

`coverage.exclude` に入っているのはプロセス境界のコードのみで、これらは smoke テスト（実プロセスを spawn）で検証されており、v8 が同一プロセス内から観測できないという理由の除外である: `btw/src/{spawn,cli}.ts`、`dashboard-server/src/{server,cli,index}.ts`、`mcp-server/src/index.ts`、`dashboard/src/main.tsx`。

## テストの書き方（本プロジェクトの規約）

- **パース境界は例外を投げない**。`{ ok } | { unsupported, version } | { error, reason }` の判別可能ユニオンを返す（team.md 構造規約3）。テストは**各 variant を個別に**検証し、「いずれか1件」で済ませない。
- **WYSIWYG は内部でなくデータ契約をテストする**（team.md）。`MarkdownSurface` は `{markdown, editable, onEdit}` の Props/Callback 契約に対して書く。レンダラ実装を差し替えてもテストが壊れないことが隔離の成立条件（ADR-05）。
- **構造的禁止はテストで守る**。`dependency-direction.test.ts`（reader-core / dashboard）が、POST 発行モジュールが1つだけであること、`fetch` を持つモジュールが2つだけであること、`marked.parse` / `dangerouslySetInnerHTML` / `innerHTML` が現れないことを走査で検証する。規約の記述ではなくテストが enforcement point。
- **アサーションを弱めない**。仕様変更でテストが落ちたら、移設・強化して直す。`toEqual` の緩和や参照比較から深い等価への後退は禁止（本ステージまでに実際に1件レビューで差し戻された）。
- **空振りのアサーションを作らない**。「要素が存在しないこと」を検証する場合は、同じ経路で**存在する**ポジティブコントロールを別テストで置く。
- **テストデータ**: 一時ディレクトリに最小のワークスペースを組み立てる方式。`tb-lxp`（約593ファイル）は read-only フィクスチャとして扱い、書き換えない。
