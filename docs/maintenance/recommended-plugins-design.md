# 推奨プラグインの同梱と導入：設計案

状態: 設計案（2026-10-08）。未実装。実装前に「11. 実装前に確認すること」を確かめ、「13. 未決事項」を決める。

## 結論

VSIX に推奨プラグインを同梱し、利用者がボタン操作でプロジェクトへ導入する機能は実現できる。aidlc-workflows のプラグインは導入先で合成する方式で、エンジン 2.10.0 は任意のローカルのプラグインルートを `AIDLC_PLUGIN_ROOT` で受け取って合成できる。Guide はすでにツールの追加・更新時に、この経路で既存プラグインを再構成している（`packages/vscode-extension/src/native-plugin-inputs.ts`）。新たに作るのは、同梱カタログ、初回導入の操作と画面、状態表示の三つになる。

ただし次の制約がある。

1. 公式が想定する配布経路は、各ツールのプラグインストア（Claude Code の `/plugin install` など）。Guide が直接合成したプラグインはツール側の導入一覧に載らないため、`aidlc doctor` のプラグイン検査が警告を出す可能性がある。実装前に確認する（S1）。
2. ルール（`memory/`）の注入は公式で未実装。ルール系のプラグインは、既存ステージへの加算（散文フラグメント）とエージェント用ナレッジで表現する。
3. Claude Code と Cursor を併用するプロジェクトでは、両方へ同じ版を入れる必要がある。Guide の更新処理は、ツール間でプラグインの選択や版が食い違う状態を受け付けない。
4. 導入するとワークフローのステージ構成が変わるため、未完了の作業がある間は導入しない。カスタマイズの保存と同じ扱いにする。

## 1. 前提

### 公式のプラグイン機構（2.10.0）

詳細は同梱リファレンスの「プラグインの仕組み」（`docs/reference/ja/18-plugin-mechanism.md`）を参照。

| 機能                 | 公式の状態                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| プラグインの構造     | `.aidlc-plugin/plugin.json` と `stages/`・`contributions/`・`agents/`・`scopes/`・`sensors/`・`tools/`・`knowledge/`                                            |
| 検証・ビルド         | `aidlc plugin validate [path]`、`aidlc plugin build <harness> [outDir] --plugin-root <path>`。オフラインで動く                                                  |
| 合成                 | `aidlc engine plugin sync`。トランザクションで適用し、失敗時はロールバックする                                                                                  |
| 有効化               | `aidlc engine plugin select aidlc,<name>`。`harness.json` の `plugins` を書く。走行中のワークフローを座礁させる変更は拒否する                                   |
| 状態                 | `aidlc engine plugin list`、doctor の `Plugins:` 行                                                                                                             |
| 既存ステージへの加算 | `produces`・`consumes`・`sensors`・`scopes`・`required_sections` と散文フラグメント。`required_sections` は宣言のみで未強制。`after-questions` アンカーは未実装 |
| 未実装（設計のみ）   | `memory/` の注入、`adds.requires_stage`、`when:` の評価、`dependencies` の解決、ロックファイル、`aidlc engine plugin add`                                       |

`harness.json` に `plugins` キーがない場合、合成したプラグインは直ちに有効になる。キーがある場合は、合成しても `plugin select` で選ぶまで有効にならない。

### Guide の既存資産

| 資産                           | 内容                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `native-plugin-inputs.ts`      | 既存プラグインの元パッケージを `plugins/<name>/`・`plugins/<name>/dist/<harness>/`・本体の導入先から探し、候補で `engine plugin sync` → `plugin select` を再実行する |
| `native-harness-install.ts`    | 一時候補で公式コマンドを実行 → 計画 → 確認トークン → ロック下で適用 → doctor、という導入の流れ                                                                       |
| カスタマイズ                   | プロジェクトの `plugins/<id>/` を自作プラグインとして一覧・編集し、標準プラグインの ZIP を書き出す                                                                   |
| 動画パック（`video-packs.ts`） | 別の拡張が `contributes.aidlcGuideVideoPacks` で宣言し、Guide は許可済みの発行者だけを読む                                                                           |

## 2. 方式の比較

| 方式                                    | 内容                                                                                     | 長所                                                                                                       | 短所                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. ツールのストアへ登録                 | 同梱した投影をローカルのマーケットプレイスとして登録し、各ツールのプラグイン導入で入れる | 公式の想定どおり。doctor の在庫と一致し、セッション開始時に自動で再合成される                              | ツールごとに手順が違う（Claude・Codex はストア、Cursor は独自形式、Kiro はフォルダー）。ホーム配下のユーザー設定を書き換える。拡張の更新で同梱先のパスが変わる。メンバーごとに導入が必要 |
| B. プロジェクトへ取り込んで合成（推奨） | 同梱ソースを `plugins/<name>/` へ置き、公式の build → sync → select で合成する           | 全ツール共通でオフライン。Guide の更新処理が既に対応している。Git で共有でき、他のメンバーは追加操作が不要 | ツール側の導入一覧に載らない（doctor の扱いは S1 で確認）。CLI だけでエンジンを更新すると既存ステージへの加算が外れ、再同期が必要                                                        |
| C. 別拡張のパック                       | 動画パックと同じく、プラグインを別の VSIX で配る                                         | Guide 本体と独立に版を出せる。将来は第三者も配布できる                                                     | 「標準で内蔵」にならない。導入方式として A か B が別途必要                                                                                                                               |

導入は B を採用する。配布単位は C と同じ「プラグインパック」の宣言にし、Guide 本体も自身の `package.json` で一つのパックを宣言する。最初は内蔵パックだけを扱い、後から別拡張のパックへ広げられる。A は、公式のインストーラーとロックファイルが実装された時点で再評価する。

## 3. 全体構成

```text
VSIX（aidlc.aidlc-guide）
  package.json   contributes.aidlcGuidePluginPacks → media/plugin-packs/builtin
  media/plugin-packs/builtin/
    pack.json          カタログ（表示名・説明・変更内容・ハッシュ）
    plugins/<name>/    作成したプラグインソース（ツール非依存）
          │
          │ 1. 事前確認
          │ 2. 一時候補で validate → build → sync → select、差分を表示
          │ 3. 承認後にロック下で適用、doctor
          ▼
利用者のプロジェクト
  plugins/<name>/                    取り込んだソース（Git 管理）
  plugins/<name>/.aidlc-guide.json   取り込み元の記録（パック・版・ハッシュ）
  plugins/<name>/dist/<harness>/     公式 build の出力（Git 管理、13. 未決事項 3）
  .claude/ .cursor/                  公式 sync が合成した結果（Git 管理）
```

## 4. パック形式

### 宣言

```json
"contributes": {
  "aidlcGuidePluginPacks": [
    { "id": "builtin", "formatVersion": 1, "root": "media/plugin-packs/builtin" }
  ]
}
```

発行者は動画パックと同じ許可リスト（`aidlc`）に限る。プラグインはセンサーや doctor 検査として実行されるコードを含み得るため、許可リスト外の宣言は読み込まず、一度だけ記録する。`root` は動画パックと同じく安全な相対パスだけを受け付ける。

### カタログ（`pack.json`）

```json
{
  "formatVersion": 1,
  "plugins": [
    {
      "name": "guide-practices",
      "version": "0.1.0",
      "title": "実践プラクティス集",
      "summary": "設計表の書き方と検証の手順を、設計・検証ステージへ加えます。",
      "recommended": true,
      "minEngineVersion": "2.10.0",
      "harnesses": ["claude", "cursor"],
      "executes": false,
      "changes": { "stages": 0, "contributions": 7, "agents": 0, "scopes": 0, "sensors": 0, "knowledge": 2 },
      "sourceHash": "sha256:…"
    }
  ]
}
```

- `sourceHash` は公式の合成記録（`plugin-compose-<name>.json`）と同じ計算にする。Guide の `native-plugin-inputs.ts` に同じ計算があり、導入後の照合に使える。
- `changes`・`executes`・`sourceHash` はビルド時にソースから生成し、手で書かない。検査で一致を確認する。
- `harnesses` は検証済みのツール。検証済みのツールを一つも含まないプロジェクトでは、導入ボタンを無効にする。

### 取り込み記録（`plugins/<name>/.aidlc-guide.json`）

```json
{
  "schemaVersion": 1,
  "pack": "aidlc.aidlc-guide/builtin",
  "name": "guide-practices",
  "version": "0.1.0",
  "sourceHash": "sha256:…"
}
```

カスタマイズ画面はこの記録があるプラグインを「推奨（同梱）」として閲覧のみにする。更新時は、記録のハッシュとプロジェクトのソースを比べ、利用者が手で変えたかどうかを判定する。

## 5. 操作

### 事前確認

次をすべて満たす場合だけ導入ボタンを有効にする。満たさない項目は理由を表示する。

- ワークスペースが信頼されている。
- aidlc-workflows が導入済みで、本体が `minEngineVersion` 以上。ネイティブ版は `aidlc` の実行ファイル、コピー版は Bun が必要。
- 未完了のワークフローがない（既存の `assertNoActiveWorkflows` と同じ判定）。
- 検出したすべてのツールで、既存プラグインの選択と版が一致している（`capturePluginInputs` が通る）。
- `plugins/<name>/` が存在しないか、同じパックの取り込み記録がある。
- 実行されるコードを含むプラグインは、同意画面で対象ファイルを列挙して承認を得る。

### 導入

1. 一時ディレクトリに候補を作る（既存の導入と同じ）。同梱ソースを候補の `plugins/<name>/` へコピーし、カタログの `sourceHash` と一致することを確認する。
2. 候補で `aidlc plugin validate` を実行し、検出した各ツールについて `aidlc plugin build <harness>` で `plugins/<name>/dist/<harness>/` を作る。
3. 各ツールについて、`AIDLC_PLUGIN_ROOT` にその出力、`AIDLC_HARNESS_DIR` にツールのディレクトリを指定して `aidlc engine plugin sync` を実行する。
4. `harness.json` に `plugins` がある場合だけ、既存の選択に加えて `aidlc engine plugin select` を実行する。ない場合は選択キーを書かず、既存の振る舞いを変えない。
5. 候補と実プロジェクトの差分を、変更されるファイル、追加されるステージと加算対象のステージ、実行コードの有無として表示する。
6. 承認後、既存のロック付き適用（`applyHarnessCandidate`、カスタマイズ対応エンジンがあれば `install-plan` → `apply`）で反映する。適用の直前に事前確認をやり直し、確認トークンが変わっていれば中止する。
7. doctor を実行して結果を表示する。

候補方式にするのは、複数ツールへの反映を一度に確定でき、適用前に差分を見せられるためである。候補で記録された監査行を実プロジェクトへどう扱うかは S3 で確認する。

### 更新

Guide の更新で同梱版が上がったら「更新あり」を表示する。取り込み記録のハッシュとプロジェクトのソースが一致する場合だけ、導入と同じ手順で置き換える。一致しない（利用者が編集した）場合は上書きせず、差分を表示して、手で反映するか、取り込み記録を外して自作プラグインとして扱うかを選んでもらう。ステージ構成が変わるため、自動更新はしない。

### 無効化と削除

- 無効化は `aidlc engine plugin select` から外す。ファイルは残り、再び有効にできる。走行中のワークフローを座礁させる変更は公式が拒否する。
- 削除は初版で提供しない。公式の `sync --prune-missing` は完全な導入一覧を前提とするため、Guide が取り込んだプラグインで安全に使えるかを S2 で確認してから設計する。

### aidlc-workflows の更新時

Guide から aidlc-workflows を更新すると、既存の再構成処理が `plugins/<name>/dist/<harness>/` を見つけて再合成する。Guide が取り込んだプラグインは、新しい本体で `plugin build` をやり直してから再合成するよう改める。合成フックの版を本体に合わせるためである。ソースは変わらないため、合成記録の `sourceHash` は一致したままになる。

CLI だけで aidlc-workflows を更新した場合、既存ステージへの加算が外れる（公式の仕様）。doctor の検出結果を、Guide では「再同期」の操作として表示する。

### チームでの共有

`plugins/<name>/` と、`.claude/`・`.cursor/` の合成結果をコミットすれば、他のメンバーは Guide の有無にかかわらず追加操作なしで同じ構成を使える。

## 6. 画面

- カスタマイズ →「プラグインを管理」に「推奨」タブを追加する。カードには名前、目的、変わるもの（追加ステージ数、加算する既存ステージ、センサー、ナレッジ）、スクリプト実行の有無、状態（未導入・導入済み・更新あり・変更あり・無効）を表示する。「内容を確認」で差分を表示し、「追加」で導入する。
- 設定パネルの手順 2 に、任意の「推奨プラグインも追加する」を置く。aidlc-workflows の導入とは別の処理として、その完了後に続けて実行する。プラグインの導入に失敗しても本体の導入は成功のままとする。
- ステージ表示では、プラグインのステージにプラグイン名のバッジを付ける。公式ドキュメントへの対応がないため、ステージファイルの説明を表示する。
- ローカルブラウザー版は一覧と状態の閲覧だけにする。導入は aidlc-workflows の導入と同じく IDE だけで行う。

## 7. 信頼と安全

- 同梱プラグインは Guide リポジトリでレビューし、VSIX に入れる。実行時にネットワークから取得しない。
- 導入前にカタログの `sourceHash` とソースを照合し、不一致なら中止する。
- 実行されるコード（`tools/*.ts`、doctor 検査）を含むプラグインは、同意画面で対象ファイルを列挙する。センサーは利用者の権限で動くことを明記する。
- 信頼されていないワークスペースでは導入しない。
- VSIX のパッケージ衛生検査の対象に `media/plugin-packs/` を加え、`.env`・秘密情報・`aidlc/` の実行時状態・テスト用フィクスチャを含めない。

## 8. プロジェクトルールとの整合

| ルール                                                                     | 対応                                                                                                                                                                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aidlc/spaces/` とアプリのリポジトリは読み取り専用（`[Answer]:` のみ例外） | 既存の導入・更新・カスタマイズと同じく、利用者の明示操作と差分確認を経た、公式コマンドの生成物の反映に限る。Guide は state と監査ログを書かない。この範囲を本機能へ広げることは承認時に確認する |
| aidlc-workflows のエンジン・ステージ定義・監査形式を変更しない             | 公式のプラグイン機構（加算のみ、コア不変）だけを使う                                                                                                                                            |
| クラウド依存と実行時の取得をしない                                         | 同梱物だけを扱い、マーケットプレイスへ接続しない                                                                                                                                                |
| 出荷ランタイムは bun のみ                                                  | 合成とセンサーは公式どおり bun で動く（ネイティブ版は本体に内蔵）                                                                                                                               |
| 品質ゲートは `bun run check` だけに定義する                                | `check:plugin-packs` を追加し、`check` に配線する                                                                                                                                               |
| VSIX に秘密情報・`.env`・`aidlc/` の実行時状態を含めない                   | 7. の衛生検査で確認する                                                                                                                                                                         |
| クロスプラットフォームのパス                                               | `node:path` と `vscode.Uri` だけを使い、コマンドはシェルを介さずに起動する                                                                                                                      |

## 9. 推奨プラグインの設計

プラグイン名は `guide-` で始める（`core`・`aidlc`・`aidlc-*` は公式の予約名）。成果物・エージェント・スコープ・センサーの識別子もプラグイン名で始める。

### guide-practices（実践プラクティス集）：初版の候補

このリポジトリで AI-DLC を運用して得た規則（`aidlc/spaces/default/memory/project.md` の学習項目）を、他のプロジェクトで使える形にする。散文フラグメントとナレッジだけを使い、スクリプトを含まないため最も低リスクである。

| 対象ステージ             | 加える指示                                                                                                                   | 元にした学び                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `functional-design`      | 先行 Unit が所有する挙動の表を冒頭に置き、差分だけを書く。予算を引用する前に、先行 Unit の予算表に行があるか確かめる         | `functional-design:c2`・`c3`      |
| `nfr-requirements`       | 横断的な予算の分解表に検算行を置き、最悪経路でも収まることを数値で示す                                                       | `nfr-requirements:c3`             |
| `nfr-design`             | 「要件 ID → 実現機構」の表で書き、機構はモジュール・関数・設定キーまで落とす。非該当にも根拠と再訪条件を書く                 | `nfr-design:c2`・`c3`             |
| `code-generation`        | 先行 Unit の契約の穴は先行側を拡張して埋める。設計表の機構は契約として扱う                                                   | `code-generation:c1`・`c4`        |
| `build-and-test`         | ビルド成果物の検査は、ファイル名のグロブではなくエントリポイントから参照先を解決して行う                                     | `build-and-test:c3`               |
| `ci-pipeline`            | 品質ゲートの定義を一か所に置き、呼び出し側は検査項目を列挙しない。否定側を先に確認する                                       | `ci-pipeline:c2`・`c5`            |
| `performance-validation` | min・p50・p95・max と cold・warm を分けて記録する。UI 経由の要件は実際の UI で測る。読み取り専用のフィクスチャは複製して測る | `performance-validation:c3`〜`c5` |

```text
guide-practices/
  .aidlc-plugin/plugin.json
  contributions/construction/functional-design.md
  contributions/construction/nfr-requirements.md
  contributions/construction/nfr-design.md
  contributions/construction/code-generation.md
  contributions/construction/build-and-test.md
  contributions/construction/ci-pipeline.md
  contributions/operation/performance-validation.md
  knowledge/aidlc-architect-agent/guide-practices-design-tables.md
  knowledge/aidlc-quality-agent/guide-practices-verification.md
  tests/README.md
```

```json
{
  "name": "guide-practices",
  "version": "0.1.0",
  "description": "Field-tested design-table and verification practices from AIDLC Guide.",
  "author": { "name": "AIDLC Guide" },
  "dependencies": ["core"],
  "aidlc": {
    "contributes": { "knowledge": "knowledge/", "overlays": "contributions/" }
  }
}
```

```markdown
---
target: performance-validation
plugin: guide-practices
fragments:
  - anchor: end-of-steps
    order: 100
---

## fragment: end-of-steps

### Measurement discipline (guide-practices)

- Report min / p50 / p95 / max, never a mean alone. Record cold and warm runs separately.
- Measure UI-facing targets through the real UI path, not by calling the API directly.
- Never write to a fixture declared read-only. Measure a copy, then record `git status`
  and mtimes showing the original is untouched.
```

アンカーはステップ番号に依存しない `end-of-steps` を基本にする。対象の 7 ステージは、いずれも 2.10.0 で `## Steps` を持つ。`after-step:<n>` は公式のステップ番号の変更で外れ、`after-questions` は未実装である。ナレッジのファイル名にはプラグイン名を付け、コアのナレッジと衝突させない。

### guide-ja-writing（日本語成果物の点検）：第 2 弾の候補

- センサー `guide-ja-writing-lint`（`fire_on: write`、`default_severity: advisory`、`matches: "**/*.md"`）を、`requirements-analysis`・`user-stories`・`nfr-requirements` に `adds.sensors` で付ける。マニフェストは公式の命名規則どおり `sensors/aidlc-guide-ja-writing-lint.md` に置く。
- 検査項目: 文体（です・ます／である）の混在、数値の基準を伴わない曖昧語（「高速」「簡単」「使いやすい」など。inception フェーズの規則に対応）、半角カナ、全角英数字。本文の大半が日本語でない成果物は対象外にする。
- product・architect エージェント向けに、日本語の技術文書の書き方をナレッジとして加える。
- スクリプトを含むため同意画面の対象になる。advisory なのでゲートは止めない。

### guide-learn（学習メモ）：要検討

北極星指標 S-1（初学者が 1 分以内に現在地を説明できる）に合わせ、主要なステージで「決めたこと・理由・次の工程」を短い別成果物として残し、Guide のステージ詳細に表示する案。`adds.produces` の論理名と出力先の対応、複数ステージで同種の成果物を出す場合の命名を確認してから設計する。

## 10. Guide リポジトリでの作り方

- 置き場は `packages/guide-plugins/<name>/`（ソースとテスト）。リポジトリ直下の `plugins/` は、このリポジトリ自身の AI-DLC 構成で自作プラグインとして扱われるため使わない。
- `build:plugin-packs` は、公式の validate を通したソースを `packages/vscode-extension/media/plugin-packs/builtin/` へコピーし、`pack.json` の生成値を書く。`build:extension` に組み込む。
- `check:plugin-packs` を `bun run check` に配線し、次を確認する。
  - 固定版のエンジンにある `aidlc-plugin-validate.ts` で全プラグインを検証する。
  - `aidlc-plugin-test.ts` で、Claude と Cursor のフィクスチャ導入に対して、drop なしで合成でき、2 回目の合成がバイト一致すること。
  - `pack.json` の生成値がソースと一致すること。
  - 7. の衛生条件。
- Vitest のテストを先に書く。対象はカタログの解析（許可外の発行者、不正な `root`、未知の `formatVersion`、ハッシュ不一致）、事前確認（未完了のワークフロー、ツール間の不一致、名前の衝突、信頼されていないワークスペース）、コマンドの順序と環境変数（偽のランナーで build → sync → select）、取り込み記録の判定（一致・編集済み・記録なし）。
- [aidlc-workflows の版更新チェックリスト](workflows-upgrade-checklist.md)に、同梱プラグインの validate と test を新しい版で再実行する項目を加える。

## 11. 実装前に確認すること

| ID  | 確認内容                                                                                                                                                                                                                                                                          | 影響する判断                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| S1  | Guide が取り込んで合成したプラグインについて、Claude（`installed_plugins.json` の有無）と Cursor で `aidlc doctor` と `aidlc engine plugin list` が何を出すか。`installed-missing` などの警告になる場合、Guide で説明を添えるか、公式へ「プロジェクト取り込み」の状態を提案するか | 方式 B の可否、doctor の表示                                   |
| S2  | `sync --prune-missing` が、Guide が取り込んだプラグインを消す条件                                                                                                                                                                                                                 | 削除機能、誤操作の防止                                         |
| S3  | 候補で実行した `plugin select` の監査行がどこに書かれるか。実プロジェクトへ反映しない場合に問題があるか                                                                                                                                                                           | 候補方式を採るか、実プロジェクトで公式コマンドを直接実行するか |
| S4  | `test-pro` と `guide-practices` を入れたとき、Guide のステージ表示・マトリクス・時間計測が、プラグインのステージと加算を正しく扱うか                                                                                                                                              | 画面側の改修範囲                                               |
| S5  | プラグイン直下の `.aidlc-guide.json` と `dist/` を、公式の validate・`sourceHash`・カスタマイズ画面が許容するか                                                                                                                                                                   | 取り込み記録の置き場                                           |
| S6  | プラグインが追加したコアエージェント用のナレッジを、エージェントが実際に読むか                                                                                                                                                                                                    | guide-practices の効果                                         |
| S7  | `adds` を持たない散文だけの寄与が validate を通り、`end-of-steps` が対象ステージで解決するか                                                                                                                                                                                      | 寄与ファイルの書き方                                           |
| S8  | Bun のないネイティブ版の環境で、プラグインのセンサーのコマンドが動くか                                                                                                                                                                                                            | guide-ja-writing の前提                                        |

## 12. 実装順と受け入れ条件

1. このリポジトリの複製と `test-pro` で S1〜S7 を確かめ、結果をこの文書に追記する。
2. `guide-practices` を作り、`check:plugin-packs` を通す。プロジェクトへの導入は公式コマンドを手で実行して確認する。
3. パックの宣言、カタログの解析、事前確認、状態表示（閲覧のみ）。
4. 導入（候補 → 差分 → 適用 → doctor）と無効化。
5. 設定パネルからの任意の導入、更新、更新情報の追加。
6. `guide-ja-writing` と別拡張のパックへの拡大は、利用状況を見て判断する。

受け入れ条件:

- Claude のみ、Cursor のみ、両方併用の各プロジェクトで、推奨プラグインを追加すると doctor が想定どおりになり、無効化 → 再有効化で合成結果がバイト一致する。
- 未完了のワークフロー、ツール間の不一致、ハッシュ不一致、信頼されていないワークスペースで導入が拒否される。肯定側より先に、これらの否定側を確認する。
- Guide から aidlc-workflows を更新したあとも、プラグインが再構成される。
- `bun run check` に `check:plugin-packs` が含まれ、検査対象を壊すと失敗する。

## 13. 未決事項

1. 初版に入れるプラグイン。推奨は `guide-practices` のみ。
2. フラグメントの記述言語。推奨は英語。差し込む先のコアのステージ本文と揃え、成果物は会話言語の規則に従って日本語で書かれる。カタログと画面の説明は日本語にする。
3. `plugins/<name>/dist/` をコミットするか。推奨はコミットする。Guide を使わず CLI だけで aidlc-workflows を更新したメンバーも、同じ出力で再同期できるためである。
4. 読み取り専用の原則の例外範囲を、導入・更新・カスタマイズと同じく本機能へ広げてよいか。
5. 方式 A（ツールのストアへの登録）を将来提供するか。公式のインストーラーとロックファイルの実装を待って判断する。
