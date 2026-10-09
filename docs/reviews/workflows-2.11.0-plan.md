# aidlc-workflows 2.11.0 調査と対応計画

対象は[公式リリース v2.11.0](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.0)（2026-10-08）、タグの参照先コミット `6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a`。比較元は manifest の公式 v2.10.0 `2a883858f5483bce3b48f43b8f6d3ca2c042d6ae`。差分は 562 コミット・1,166 ファイル。公式タグの独立 checkout で依存を導入し、`scripts/package.ts` で全ハーネスの配布物を生成して調べた。この文書は調査と計画だけを記録する。実装・同期・版の更新はまだ行っていない。

## 結論

- **破壊的な変更はない。** State Version **8**・基本 **33 ステージ**・エージェント **14** は維持。`check-workflows-drift` は blocking 0、findings 5（導入先・Doctor 対応版・AGENTS・README・bridge の版表記）。ステージグラフのキーと produces / review_artifact も同じ。
- **Guide 唯一の書き込みである `[Answer]:` は互換。** エンジンは今も質問ファイルの `[Answer]:` を読む。回答済みの質問ファイルは、新しいチャットで再開したときにも引き継がれる。
- **ただし、表示が消える問題がいくつかある。** 2.11 で既定の Guard Policy が `enterprise` 以外 `off` に、collaborators も `off` になったため、頻繁に起きる見込み。特にレビュー判定と効果測定の表示は、利用者が aidlc 本体を 2.11 に上げた時点で、Guide のピンとは無関係に影響を受ける。
- **作業の前提として Bun の更新が必要。** `packageManager` が `bun@1.3.6` のままでは、上流 2.11 の配布物生成が失敗する（実測: kiro-ide manifest の async require エラー）。2.11 の Markdown 解析も 1.3.6 では例外になる（`Bun.markdown` には 1.3.8 以上が必要）。CI は全ワークフローがこの値に従う。

## 主な変更点（CHANGELOG の要約）

- 既定の変更: Guard Policy と collaborators は `enterprise` 以外 off。`/aidlc --plan-approval on|off` を新設し、`express` と `poc` は off。`bugfix` は learnings と要約確認を尋ねない。
- Plan Approval はエンジンが尋ねる。計画の指紋をエンジンが保持し、承認済みの計画は再度尋ねない。`testing-posture fingerprint --reapprove` は廃止。
- 返答は本人の言葉のまま読み、そのまま記録する（`HUMAN_TURN` / `GATE_APPROVED` に原文の項目が加わった）。どのチャットからでも答えられる。
- bare `/aidlc` は再開メニューを出さずに作業を続ける。`--skip` / `--add`、スコープ変更、Construction 設定は、一行の戻し方を添えて即時に実行する。
- Construction は完了済みの Unit を保持する（スコープ変更・ジャンプ・方式切替のとき）。レビューが終わっていなくても承認できる（`Approved. The <Stage> review did not finish.`）。
- 合成した計画はスコープファイルを書かない。保存するときは `engine scope save`。
- `--project-type`、`aidlc config --download` / `--show` を追加。作業中でも `config` を実行できる。ハーネスごとの版ずれを診断する。hooks が一度も動いていないときは、そのハーネス固有の手順を案内する。
- refresh はチームのファイル（settings.json の hooks / permissions / statusLine、`.gitignore` の自前ルールなど）を保持する。copy 版の runtime は Bun 1.3.8 以上が必要。

## 影響と対応

重要度は次の3段階。**高** は出荷前に必須、または既存の表示が消えるもの。**中** は 2.11 の機能が Guide に反映されない、または表示が不正確になるもの。**低** は表記や任意の改善。

### A. 前提・同期基盤

| 重要度 | 内容 | 対象 | 対応 |
|---|---|---|---|
| 高 | Bun 1.3.6 では上流の生成と 2.11 シェルの Markdown 解析が失敗する | `package.json` の `packageManager`、`.github/workflows/*` | `bun@1.4.2`（上流 CI・`@types/bun` と同じ）に上げ、`bun.lock` と全体 check を確認する |
| 高 | `scripts/workflows-shell-overrides.json` のパッチ5件すべてで上流のハッシュが変わり、このまま同期すると全件上書きされる | `.claude` / `.cursor` | 下の3行に分けて対処する |
| — | `hooks/aidlc-plan-approval-guard.ts`（2件）: 2.11 の `codeGenerationGateHeld` が同じ場面を許可するので不要になった | 同上 | override を削除し、`scripts/plan-approval-guard-patch.test.ts` をゲート開放後の承認報告が通る回帰テストに置き換える |
| — | `tools/aidlc-audit.ts`（2件）: Windows の O_APPEND 位置指定の修正は 2.11 でも必要 | 同上 | 再適用し、ハッシュを更新する |
| — | `.cursor/hooks/aidlc-cursor-adapter.ts`（PR #43）: live でない workflow の素通しは 2.11 でも必要 | 同上 | 3つの hunk を再適用し、公式配布物との差分がパッチだけであることを照合する |
| 中 | ルートの `.gitignore` が旧ブロックのままで、`aidlc.settings.local.json` がない | `.gitignore` | 2.11 の `# AI-DLC: local working files` ブロックに揃える |

### B. reader の互換性（aidlc 本体が 2.11 になった時点で効く）

| 重要度 | 内容 | 対象 | 対応 |
|---|---|---|---|
| 高 | project 設定の `flags.questionRetentionDays` を未知のキーとして拒否し、token とコストの表示が丸ごと隠れる | `reader-core/src/effectiveness/settings-schema.ts` | キーを追加する。bypass の全層和集合と、許可リストにない `AIDLC_DISABLE_SENSORS` / `_LEARNINGS` / `_SUMMARY_CONFIRMATION` も上流に合わせる |
| 高 | `STAGE_JUMPED` が新しい試行を始めるのは Target 以降だけになったが、Guide は全ステージの判定を消す | `tree/review-records.ts`、`effectiveness/derive.ts`、`timing/run-floor.ts` | `Target` を読み、ステージ順で判定する（上流の `stageJumpReaches`） |
| 高 | relaxed / off では記録 JSON（gitignore 対象）がない `REVIEW_COMPLETED` でも、上流は監査の Verdict を使う。Guide は null を返し、新しいクローンや他のマシンで判定が消える | `tree/review-records.ts` | strict 以外で記録パスが ENOENT のときに限り、監査の Verdict を採用する。ダイジェストの不一致は引き続き拒否する |
| 高 | ソース指紋の除外対象が増えた（`.DS_Store`・`.vs`・`__pycache__`・.NET の `bin` / `obj` など）。strict で 2.11 の記録と一致しない | `tree/review-freshness.ts` | 新しい規則を追加し、旧指紋も別名として一致させる |
| 中 | memory のいちばん狭い層の `relaxed` / `off` が上書きするようになった。Guide は strict しか反映しない | `tree/review-freshness.ts` の `mode()` | 上流と同じ優先順位を実装する |
| 中 | Unit の run floor がジャンプの到達範囲と `CONSTRUCTION_POLICY_SET` を考慮するようになった | `timing/run-floor.ts` | 上流の規則に追随する |
| 中 | Plan Approval のファイル（`# Code Generation Plan Approval`）をエンジンが丸ごと生成し、承認後に `[Answer]:` を書き換えるとビルドが止まる | `dashboard/src/viewer/AnswerEditor.tsx` | このファイルと要約確認の行を読み取り専用にするか、警告を出す |
| 低 | 新しい state 項目（`Plan`・`Plan Approval`・`Collaborators`・`Project Type Source`）を読んでいない。Plan Approval が off でも次のゲートに計画承認を出す | `parse/state.ts`、`timing/next-gate.ts` | 任意の項目として読み、NowStrip と次のゲート表示に使う |
| 低 | 新しい監査イベント10種と `GATE_APPROVED` の `Review: not finished` / `Approves Together` を区別しない。checkpoints off でまとめて承認されることも反映しない | `audit/`、`timing/`、`tree/matrix.ts` | `UNIT_SKIPPED` と「レビュー未完了のまま承認」を表示に取り込む |

### C. Doctor

| 重要度 | 内容 | 対応 |
|---|---|---|
| 高 | `human-v1` 形式は互換（Linux の copy 版6ケースを実採取し、解析できない行0・構造エラー0）。ただし `doctor-compatibility.json` に 2.11.0 がないので、原文表示に退避する | 3 OS・27ケースを `doctor-contract.yml` で採取して登録する。`sourceDigests` が変わった76ファイルは人がレビューする |
| 高 | 採取プロジェクトは一度もチャットしていないため、`AIDLC hooks have not run in this project yet` が常に warn になり、healthy のケースが warning として失敗する | `capture-doctor-fixtures.ts` で heartbeat を作るか、シナリオの期待値を見直す |
| 高 | `capture-doctor-fixtures.ts` の machine 正規表現に `Windows launcher` がなく、fallback 文も古い | 上流の `machinePattern` と固定文に合わせる |
| 高 | 未訳・文言変更: hooks 未実行と各ハーネスの手順、`disableAllHooks` の fix、`AI-DLC files`、`Plugins`、`Harness trees on different releases`、Runtime hook PATH、Windows launcher / uninstall recovery、update channel、Kiro Session model、VS Code の request cap、新しい analysis ID（`stage-state-audit-drift`・`current-stage-not-started`）など。旧パターンの一部は一致しなくなる | `doctor-messages-ja.ts` に訳を追加し、失効したパターンを置き換える。全診断コードの訳の有無を回帰テストで確認する |

### D. 導入・更新（拡張）

| 重要度 | 内容 | 対象 | 対応 |
|---|---|---|---|
| 中 | 2.11 は root contribution に `json-entries`（opencode.json）と `jsonc-settings`（Copilot の `.vscode/settings.json`）を追加した。Guide の複数ハーネスマージはこの2方式を知らずに throw する。`.gitignore` も上流は既存ルールの**後**に置くが、Guide は先頭に置く | `vscode-extension/src/native-harness-merge.ts` | 2方式を実装し、ブロックの位置を合わせる（Claude と Cursor だけなら影響はない） |
| 中 | 上流は作業中でも `aidlc config` を実行できるようになったが、Guide は `assertNoActiveWorkflows` で拒否し続ける | `native-harness-install.ts`、`workflows-*-update.ts`、`cli-management.ts` ほか | **要判断**（下記） |
| 中 | `install.ps1` は UAC で昇格した窓でも `-Yes` があれば警告を出して導入を続ける。Guide は常に `-Yes` を渡すので、黙って管理者として導入する | `native-setup.ts` | **要判断**（下記）。`AIDLC_ALLOW_ADMIN_INSTALL` の削除は無害 |
| 低 | アセット名・`version.json`・`checksums.txt` は変わっていない。`update` / `uninstall` / `prune` の変更は Guide が呼ばないので無関係 | — | 対応不要 |

### E. 文書・説明

- **英語の同期対象:** 75ページ（追加4・変更71、+8,496 / −2,276行）。画像・動画の変更はない。追加は `guide/onboarding.md`、`guide/facilitator-guide.md`、`guide/writing-inputs/` の2ページ。目次と索引はファイルを自動で拾う。ただし `writing-inputs` の日本語フォルダ名を `official-docs/src/folder-labels.ts` に追加する必要がある。
- **日本語の作業量:**

  | 優先 | 対象 | 量 |
  |---|---|---|
  | P1 利用者向け | guide 35ページの差分と新規4ページの全文訳、`release-highlights.md`、`overview/ja/releases/2.11.0.md`。挙動が変わる 02・05・06・07・11・13 と、大きい 12・15・18、harnesses の copilot・kiro-ide・kiro-cli を先に扱う | 約4,650行 |
  | P2 開発者向け（日本語が現行） | harness-engineering 8ページ、reference 15ページ | 約700行 |
  | P3 v2.10.0 から更新待ちの13ページ | v2.9.0 基準のため、v2.11.0 までの差は +6,163 / −1,173行 | 大 |

- **docs-bridge:** `sourceVersion` を更新する。`user-stories`（モブは enterprise か collaborators on のときだけ）、`code-generation`（計画承認はエンジンが尋ね、express・poc・`--plan-approval off` では行わない）、`terms.classic` / `express` の既定値を直す。agent-map の support 役（design・developer・quality・devsecops・compliance、architect の RE 統合）は、既定では使われないことを明記する。composer がスコープファイルを書かなくなった点も直す。成果物の説明は `bun run build:artifact-map` で再生成する。
- **独自文書:** `docs/guides/aidlc-tip-switch-iteration.md` は修正が必須（Construction 中の設定変更は即時に実行されるようになった）。`aidlc-tip-construction-order.md`、`aidlc-tip-solo-unit-bolt.md`、`aidlc-tip-compose-nfr.md`、`aidlc-tip-stage-recovery.md`、`stage-timing.md` は追記する。そのほかの tips は版表記と固定 SHA のリンクだけ更新する。`guide/en/getting-started.md` と `reference/{en,ja}/scopes.md` には 2.9.0 の表記が残っている（2.10 からの残件）。
- **画面:** カスタマイズのスコープ編集で `plan_approval` / `collaborators` / `existing_code` を編集できない（`ItemEditor.tsx`）。`scope-descriptions.ja.json` は既定値が古い（relaxed のまま）。
- **更新情報:** `whats-new.ts` に `workflows-2-11` を追加する。2.10 と同じく `release:minor` の想定。

## 作業の分け方（案）

各 PR は `main` から切った短命ブランチで行い、`bun run check` を通してから squash-merge する。互換性検査（`check:workflows-compatibility`）は導入先の版と Doctor の証跡を突き合わせるので、版を上げる PR には Doctor の登録まで含める。

1. **PR-1 reader の互換修正（B の高・中）。** ピンに依存せず、aidlc 本体を 2.11 に上げた利用者の表示を守る。先に出す。fixture は 2.11 の実形式で作り、失敗するテストを先に書く。
2. **PR-2 Bun 1.4.2 へ更新（A の1行目）。** CI 全体と VSIX の生成を確認する。
3. **PR-3 Doctor の準備（C）。** 採取スクリプトの修正、訳の追加、失効したパターンの置き換え。そのうえで `doctor-contract.yml` を公式 v2.11.0 に対して実行し、3 OS の採取物を得る。
4. **PR-4 2.11.0 への同期。** 英語文書・`.claude`・`.cursor`・manifest・版宣言（README・AGENTS・bridge・`WORKFLOWS_TARGET_VERSION`）。A のパッチ整理、`.gitignore`、Doctor レジストリの登録、成果物 map と索引の再生成、`folder-labels`、更新記録 `workflows-2.11.0-update.md`、`whats-new` を含める。
5. **PR-5 表示の追随（B の低、E の画面）。** state の新項目、監査イベント、まとめて承認するゲート、カスタマイズの新キー、スコープ説明の訳。
6. **PR-6 導入まわり（D）。** マージ方式の追加と、下記の判断の反映。
7. **PR-7 以降 日本語の文書。** P1 → bridge・独自 tips → P2 → P3 の順で進める。翻訳承認ハッシュ（`official-docs.translations.json`）は人間の確認なしに記録しない。

## 判断が必要な事項

1. **作業中の `config` 実行:** 上流に合わせて Guide の GUI からも許可するか（戻し方の表示を含む）、従来どおり拒否するか。
2. **管理者として起動した VS Code からの導入:** 昇格を検知して止めるか、上流の警告を日本語で表示して続行するか。
3. **今回の日本語の範囲:** P1 まで（P3 は注記を v2.11.0 の SHA に更新するだけ）にするか、P3 の全文翻訳まで含めるか。
4. **PR-1 を 2.11 同期より先に出してよいか。** 2.10 の利用者に影響しない読み取りの拡張だけで構成する。

## 調査の範囲と未確認事項

- Doctor は Linux の copy 版6ケースだけを実採取した。native 版と Windows・macOS は未採取。このコンテナでは `bun-path` のシナリオを再現できない。
- reader の影響はコードの比較によるもので、2.11 で実際に動かした workspace を Guide で表示する確認はまだ行っていない。PR-1 の受入条件にする。
- 実拡張ホストでのネイティブ導入は、今回も未検証。
