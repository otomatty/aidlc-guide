# aidlc-workflows 2.11.0 更新記録

対象は[公式リリース v2.11.0](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.0)、SHA `6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a`。比較元は manifest の公式 v2.10.0 `2a883858f5483bce3b48f43b8f6d3ca2c042d6ae`。調査と判断事項は[2.11.0 調査と対応計画](workflows-2.11.0-plan.md)、文書の差分は[同期差分](official-docs-diff-2.11.0.md)を参照。

## 変更内容と互換性

- State Version **8**・基本 **33 ステージ**・**14 エージェント**は維持。`packageManager` を Bun 1.4.2 に上げた（1.3.6 では上流の配布物生成と 2.11 シェルの解析が失敗する）。英語文書・Claude/Cursor シェル・manifest・README・AGENTS・bridge・`WORKFLOWS_TARGET_VERSION` を 2.11.0 に揃えた。plan-approval-guard の override は上流で解消したため削除し、audit と Cursor adapter のパッチは再適用した。
- **バージョン確認**（[設計](../maintenance/version-gate-design.md)）: プロジェクトやエンジンの版が `WORKFLOWS_TARGET_VERSION` と違う場合、ダッシュボードの代わりに更新画面を出し、API・MCP は 409 / ツールエラーで止める。開いたままにするのは更新・セットアップ画面、同梱ドキュメント、Doctor と修復だけ。Guide 更新ダイアログは、新しい Guide が別の版に対応する場合に事前に知らせる（リリースに `aidlc-guide-release.json` を添付）。
- **作業中の設定変更**（決定事項1）: 導入・更新・修復・CLI 準備で、進行中の作業を理由に止めない。`aidlc config` の変更行（`Updated. Your open work (<name>) carries on.`・戻し方）を日本語で表示する。
- **管理者権限での導入**（決定事項2）: Windows で UAC 昇格した VS Code からの導入は、上流と同じ警告を日本語で表示し、確認を得た場合だけ `-Yes` を渡す。確認できない場合は停止する。`AIDLC_ALLOW_ADMIN_INSTALL` の削除処理は外した。Windows 実機では未検証。
- **複数ハーネスのマージ**: `jsonc-settings`（`.vscode/settings.json`）と `json-entries`（`opencode.json`）を、コメントを保ったまま項目単位で扱う（`jsonc-parser` を追加）。新しい `.gitignore` ブロックはチームの規則の後に追記する。上流との差: 読めない JSONC は上流のように続行せず日本語エラーで止める。記録のない既存エントリはチームのものとして扱う。
- **reader**: `questionRetentionDays` と bypass の層横断の和集合、`STAGE_JUMPED` の Target 以降だけへの到達（レビュー記録・効果測定・run floor・承認待ち・runId・スケルトン）、run floor の序数と `CONSTRUCTION_POLICY_SET`、relaxed / off で記録 JSON がない場合の監査 Verdict、ソース指紋の除外と旧値の別名、memory の relaxed / off を追従。状態ファイルの手続き設定（Plan Approval・Collaborators ほか）・プロジェクト種別・Plan を読み、Now strip に記録値として表示する。計画承認が off の作業では計画承認ゲートを予測せず、Approves Together を次の承認に反映する。`UNIT_SKIPPED`・`QUESTION_REPLIED` を作業イベントとして扱う。
- エンジンがチャットから記録する回答（計画承認・要約確認）は、画面と API の両方で書き込みを拒否する。
- スコープ編集に `plan_approval`・`collaborators`・`existing_code` を追加。更新情報に `workflows-2-11` と `version-check`、`guide/writing-inputs` の表示名を追加。docs-bridge の説明（ユーザーストーリーのモブ、計画承認、classic / express の既定、協働エージェント、コンポーザー）を直した。

### 上流と一致させていない点

- 計画承認の予測は、マシン側の off スイッチ（Guide 自身の環境変数と設定ファイル）、作業の記録値、記録がない場合はスコープの既定値（スコープファイル、なければ 2.11.0 の同梱スコープ）の順に読む。エージェントを起動した環境の変数は読めない。ほかの手続き設定は記録値だけを表示する。
- Approves Together は「Current Stage がブロックの先頭」の条件を見ない近似。`Review: not finished` は記録するが画面には出していない（対象ステージが行に書かれないため）。
- STAGE_JUMPED の順序は compiled `stage-graph.json` ではなく Stage Progress から得る。cross-shard の同時刻（`AMBIGUOUS:`）は従来どおり未対応。

## Doctor

診断の日本語訳・パターンと採取スクリプトの修正（Windows launcher、上流の既定の対処文、最初のメッセージ後の状態を作る公式 human-turn フック）を行い、2.11.0 の契約（依存ソースの指紋）を登録した。[CI 実行 37884056103](https://github.com/otomatty/aidlc-guide/actions/runs/37884056103) は 3 OS × 9 ケースを採取し、未知行・翻訳漏れ・件数・終了コードの照合は 3 OS とも問題なし。

作業環境から artifact を取得できなかったため、doctor-contract に手動実行専用の `record` ジョブを追加した（`record: true` の手動実行だけ、main 以外のブランチで動く）。[CI 実行 37890036961](https://github.com/otomatty/aidlc-guide/actions/runs/37890036961) が 3 OS × 9 ケース、計 27 ケースを採取し、`record-doctor-candidate.ts` の検査を通したものを登録した（`5d684a5`）。2.11 の Doctor は「Hooks last fired」に実行ごとの時刻を出すため、採取時に UTC 時刻を固定値（`2000-01-01T00:00:00Z`）へ正規化し、[CI 実行 37892044808](https://github.com/otomatty/aidlc-guide/actions/runs/37892044808) で登録し直した（`eda6362`）。再採取した出力が登録済みの証拠と一致することを CI で確認する。出力の捏造や旧版 fixture の版番号だけの置換は行っていない。

## 文書

- 英語 75 ページを同期。日本語は変更のあった全ページ（v2.10.0 から更新待ちだった 13 ページを含む）を英語の全文と照合し、新規 4 ページ（facilitator-guide、onboarding、writing-inputs の 2 ガイド）と 2.11.0 の更新履歴を追加した。日本語は 108 ページ。翻訳の更新待ちの注記は 0 件。
- 見出し数・表の行数・コードフェンス数を各ページで英語と照合。日本語の内部リンクとアンカーを全ページで検査し、英語版と同じ形で残る上流前提のリンク以外の不一致は 0 件。
- 独自 tips を更新（switch-iteration は全面改稿、construction-order・solo-unit-bolt・compose-nfr・stage-recovery・stage-timing に 2.11 の追記、ほかは版表記と固定 SHA）。
- `official-docs.translations.json`（人間の翻訳承認）は変更していない。

## 検証

- `AIDLC_ACTIVE_INTENT=260730-docs-i18n VITEST_MAX_WORKERS=4 bun run check`: 成功。264 ファイル・4,746 件成功・1 件 skip。lint・整形・型・文書索引・video packs・plugins・互換性（Doctor 証拠を含む）・coverage・監査 shard・`bun audit`（脆弱性なし）を含む。
- 成果物 map: 表の行順 65/65 一致。code-generation の日本語の出力表は英語と行ごとに照合して `--accept-ja-order` で再ペアリングした。
- `bun run package:extension`: 成功（684 ファイル、8.75 MB）。

VS Code／Cursor の実拡張ホストでの操作（バージョン確認画面、作業中の更新、管理者権限の確認）は未検証。
