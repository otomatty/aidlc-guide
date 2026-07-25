# Team-Level Rules

> This team's affirmed practices and corrections. Loaded after `org.md` as
> strict-additive guidance; contradictions with broader policy are rejected.
> Populated by the practices-discovery affirmation gate. Edit at the gate,
> not directly.

## Way of Working
Trunk-based development を継続する。すべての作業は `main` から切った短命な
feature/Bolt ブランチで行い、`main` へ squash-merge する（org.md 既定どおり、
Q1 で確定）。Construction の worktree ベース／マージ先はどちらも `main`。

## Walking Skeleton
Bolt 1（ソロ・ゲート付き）のスライスは「状態ファイルを1つ読む → Dashboard の
Now strip を1画面描画する」に確定（Q2）。aidlc-reader（reader-core）→
Dashboard の統合点を最小構成で先に証明する。人間が明示承認してから Bolt 2 以降
に進む。完了後、残りのBoltを自律継続するか毎回ゲートするかのラダープロンプトが
発火する。

## Testing Posture
テストランナーは **Vitest** に確定（Q3）。理由: Vite 設定を共有でき、
branch coverage（v8/istanbul）と `@testing-library/react` による React
コンポーネントテストの両方に対応する。`bun test` は branch coverage を持たず
パーサの検証要件を満たせないため不採用。

- **パーサ / State-Version reader（リスクの中心）**: branch coverage 重視 +
  tb-lxp フィクスチャに対するゴールデンテスト。State Version 検知・
  unsupported-version の明示拒否（C-T3）・不正/欠損入力の網羅を必須とする。
- **UI 層**: ライン カバレッジ ~80% を目安とする。
- **Milkdown/WYSIWYG（M3）**: 実フィクスチャを用いた表示検証（データ契約への
  アサーション）+ 手動ビジュアルチェックリストで補完する。M3 のエディタ差し替え
  可能性（C-O3）に備え、テストは Milkdown 内部ではなくエディタへ渡すデータ契約
  を対象とする。
- **ローカル品質ゲート**（`bun run check` 相当）= テストスイート green +
  カバレッジ床クリア + Biome lint/format + `tsc --noEmit` typecheck。CI基盤が
  ないため、この単一ローカルコマンドが唯一のゲート。
- tb-lxp（約593ファイル）はテスト用の read-only フィクスチャとして扱い、
  書き換えない。パーサのゴールデンテストと性能ベースラインの両方で
  決定的であるよう、特定コミット/スナップショットにピンする。

> 注（evidence.md 参照）: Vitest は dev-time の devDependency であり、
> ビルド成果物として出荷されるランタイムではない。したがって C-T1
> 「ランタイムは bun のみ」には抵触しない。

## Deployment
**本プロジェクトはローカル専用ツールで、クラウド・ステージング/本番環境・CDパイプ
ラインは存在しない。** org.md の「Deployment」（deploy-on-merge to staging、
本番は手動承認）はこの前提が成立しないため適用しない。以下をローカル
「リリース」の定義として確定する（Q4）:

- 「リリース」= `main` へ squash-merge された状態、または git タグを打った
  コミット
- 配布は `bun install` → `bun run <script>` のようなローカル実行手順のみ
  （インストーラー・パッケージ配布・環境変数によるデプロイ先切替は不要）
- 動作確認は deployment-execution/deployment-pipeline ではなく
  performance-validation ステージのローカル計測（起動→初回表示3秒以内、
  変更→反映2秒以内、tb-lxpフィクスチャで測定、NFR-2/NFR-3）で代替する
- ロールバック手順 = `git revert` / 直前タグへの `git checkout`。インフラの
  ロールバックは存在しない

## Code Style
Formatter/Linter は **Biome 単一ツール**に確定（Q5）。bun+TS プロジェクトで
format+lint を単一依存・単一設定で賄い、Prettier↔ESLint の調停コストを避ける。

- 命名規則は言語慣習通り（TS: camelCase、型/コンポーネントは PascalCase）
- Windows Git Bash と macOS の両方で動くこと（パス処理・プロセス spawn は
  node:path / bun のクロスプラットフォーム API を使う。`path.sep` 決め打ち禁止）

構造規約3点（PU-01 reader-core を最初の Bolt が固定するため、骨格が固まる前に
確定 — Q5）:

1. **reader-core は UI/トランスポート非依存**。React・MCP SDK・HTTP/WebSocket
   を一切 import しない純データ層とする。MCP・Dashboard・Mob の3サーフェスは
   reader-core を一方向に消費するのみで、逆依存（reader-core が UI 型を参照）
   は禁止（NFR-6/C-T3 のバージョン耐性の土台）。
2. **State-Version パーサは単一の差し替え可能モジュールに隔離**する（例
   `reader-core/parse/`）。State Version 依存のロジックはこのモジュール以外に
   漏らさない（NFR-6/C-T3）。
3. **パース境界は判別可能ユニオン型の Result を返し、throw しない**。公開パース
   APIは `{ ok } | { unsupported, version } | { error, reason }` の形を返す。
   reader-core 境界を越えた例外送出は禁止。ファイル欠落・不正 state は握り潰さ
   ず unsupported/error として表現する（NFR-6 の fail-soft「解析不可」表現）。
## Forbidden

<!-- Team-specific forbidden patterns -->

## Mandated

<!-- Team-specific mandates -->

## Corrections

<!-- Self-learning loop appends here. -->
