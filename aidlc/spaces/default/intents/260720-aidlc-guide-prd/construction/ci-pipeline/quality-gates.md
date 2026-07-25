# Quality Gates — AIDLC Guide

> ci-pipeline (3.7) / lead: pipeline-deploy / 2026-07-26
> 入力: `construction/build-and-test/build-and-test-summary.md`（ゲートの構成）+ `construction/build-and-test/build-test-results.md`（実測値）+ 全9 Unit の `code-summary.md`（各 Unit が守る不変条件）+ team.md Testing Posture / project.md Mandated

## ゲートは1つだけ

マージ前に通す条件は `bun run check` **のみ**である。追加のチェックリスト・別コマンド・目視確認をゲートに積まない。CI 基盤が無いこのプロジェクトでは、これが唯一の自動的な防壁だからである（team.md）。

```
bun run check
  1. biome check .                        静的解析・書式
  2. tsc --noEmit                          型検査（ワークスペース）
  3. tsc --noEmit -p packages/dashboard    型検査（SPA）
  4. vitest run --coverage                 テスト + カバレッジ閾値
  5. bun audit                             依存の脆弱性
```

`&&` 連結なので、いずれか1つが落ちた時点で失敗する。**部分的な成功という状態は無い。**

## 各ゲートの合否条件

| # | ゲート | 合格条件 | 落ちたときの意味 | 実測（c40ac24 時点） |
|---|-------|---------|----------------|-------------------|
| 1 | Biome | 指摘0件 | 書式または lint 違反。`noRestrictedImports`（fs 書込 API）と `noDangerouslySetInnerHtml` を含むため、**書込境界・XSS 経路の構造的禁止もここで落ちる** | ✅ 155ファイル・指摘なし |
| 2/3 | `tsc --noEmit` ×2 | エラー0件 | 型の不整合。`shared-types` はランタイムコードを持たないため、**この工程が唯一の検査**になる | ✅ エラーなし |
| 4 | Vitest | 全件 pass + カバレッジ閾値クリア | 挙動の退行、または `reader-core/src/parse/**` の branch カバレッジが 95% を割った | ✅ 685 passed / 2 skipped / 0 failed |
| 5 | `bun audit` | 脆弱性0件 | 直接または推移依存に既知 CVE。**lint 失敗と同格の失敗**として扱い、抑制しない（project.md Mandated） | ✅ 脆弱性なし |

### カバレッジ閾値（強制されるのは1箇所）

| 対象 | 閾値 | 強制 | 実測 |
|------|------|------|------|
| `reader-core/src/parse/**` | branch 95% / statement 95% / function 95% / line 95% | **`vitest.config.ts` が強制**（下回るとコマンドが失敗） | statement 100% / branch 98.82% |
| UI 層 | line 80% | 目安（強制しない） | components 94.94% / viewer 96.64% / store 100% |
| リポジトリ全体 | 目標なし | — | Statements 96.53% / Branches 92.60% / Lines 97.73% |

パーサだけを**分岐**で縛るのは、State Version パーサが本プロジェクトのリスク中心だからである（team.md）。ライン数で縛ると、分岐の片側だけ通したテストが閾値を満たしてしまう。

### skip をどう読むか

現在 2件が `skipIf` で skip される（docs 未配置 / symlink 作成権限なし）。**skip は「合格」ではない**。特に symlink による containment 突破ベクタは、権限のある環境で一度通すまで未検証である（`security-test-instructions.md` S-2）。ゲートは skip を失敗にしないため、この確認は人が行う。

## ゲートを走らせる場所

| 場所 | 発火 | 状態 |
|------|------|------|
| `scripts/hooks/pre-push` → `.git/hooks/pre-push` | `git push` 時 | ✅ **本ステージで実行検証済み**（下記） |
| `.github/workflows/check.yml` | `main` への push / PR | ⏳ 未実行（リモートが無い。初回実行が受入確認） |

どちらも `bun run check` を呼ぶだけで、チェック項目を各自で列挙しない。ゲート定義の単一の置き場は `package.json` の `check` スクリプトである。

### pre-push フックの実行検証（2026-07-26）

主張するだけでは意味が無いので、**落ちることと通ることの両方**を実際に確かめた。

**否定側（ゲートが落ちるときフックが push を拒むか）** — 型エラーを1つ仕込んで実行:

```
$ printf 'const x:number = "boom";\n' > packages/shared-types/src/__gate_probe.ts
$ sh .git/hooks/pre-push
exit=1
pre-push: the gate failed — push refused.
```

**肯定側（クリーンな木で通るか）** — プローブを削除して実行:

```
$ sh .git/hooks/pre-push
exit=0
No vulnerabilities found
pre-push: gate passed.
```

肯定側だけを見ると「常に 0 を返すフック」と区別がつかない。否定側を先に確認したことで、このフックが**実際にゲートの結果に反応している**ことが確かめられた。検証後、作業ツリーは元の状態に戻っている（`git status --porcelain` が 0 行）。

## マージ前の手順（trunk-based）

1. `main` から短命ブランチを切る（1〜2日で解消。org.md）
2. 作業する
3. `git push` — pre-push フックが `bun run check` を走らせる。落ちたら push されない
4. `main` へ **squash-merge**。Bolt 1つが `main` の1コミットになる
5. worktree を破棄する（元ブランチには全コミット履歴が残る）

`--no-verify` による迂回は禁止しない。ただしそれは「このゲートが捕まえるものを、他に捕まえるものが無い」と理解した上での操作である。

## ゲートに**含めない**もの（意図的な線引き）

| 項目 | 理由 |
|------|------|
| 性能の秒数（NFR-2 / NFR-3） | 実行環境の負荷に依存し、ゲートが負荷で赤くなると「緑になるまで再実行する」習慣を生む。**performance-validation (4.6) の計測**として分離する |
| 実ブラウザでの a11y / mermaid 描画 | 自動化に見合わない。手動受入項目（MA-3 / MA-6）として明示的に残す |
| LAN 到達性（MA-1 / MA-2） | 別端末が必要。原理的にローカルゲートに入らない |
| ドキュメントと実装文言のドリフト検知 | 意図的に持たない（tech-stack-decisions.md）。引用元をファイル名付きで併記することで、変更時に気づける形にするに留める |
| 文書 lint | team.md: 体裁ではなく内容。Biome 2.x は Markdown を lint しない |

**ゲートを増やさないことも設計判断である。** 通らないゲート・遅すぎるゲート・環境依存で赤くなるゲートは、いずれも外される。外されたゲートは無いのと同じで、しかも「ある」と誤解される分だけ悪い。

## 未充足の前提

| 項目 | 状態 | 解消のトリガー |
|------|------|--------------|
| GitHub Actions workflow の実行 | 未検証（同梱のみ） | リモートを設定した最初の push |
| macOS でのゲート実行 | 未実行 | 上記 workflow の macos ランナー、または手元の macOS |
| symlink containment ベクタ | 本環境では skip | symlink 作成権限のある環境で1度実行 |
