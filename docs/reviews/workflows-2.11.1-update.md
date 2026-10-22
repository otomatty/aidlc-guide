# aidlc-workflows 2.11.1 更新記録

対象は[公式リリース v2.11.1](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.11.1)（2026-10-20）、タグが指すコミット `895a35d86d20336d9b7bc4aedc9440e4a12c83ab`。比較元は manifest の公式 v2.11.0 `6a378b53c0a4fe0641ed7d8de8dfff94264d5b6a`。差分は 548 コミット・1,283 ファイル。文書の差分は[同期差分](official-docs-diff-2.11.1.md)を参照。

毎日の同期ジョブ（aidlc-workflows-update）は 2026-10-20 以降 2.11.1 を検出していたが、Doctor の新しい診断行が未訳のため 3 OS の採取検査で止まり、PR は作られていなかった。今回は公式タグの独立 checkout から配布物を生成し、手元で同期した。

## 変更内容と互換性

- State Version **8**・基本 **33 ステージ**・**14 エージェント**は維持。`check-workflows-drift` は blocking 0、findings 5（導入先・Doctor 対応版・AGENTS・README・版表記）。
- 英語文書・Claude / Cursor シェル・manifest・README・AGENTS・bridge・`WORKFLOWS_TARGET_VERSION`・`.aidlc-version` を 2.11.1 に揃えた。ルートの `.gitignore` の AI-DLC ブロックに `aidlc/active-memory/` と `aidlc/.aidlc-request-text/` が加わった。
- シェルのローカルパッチ: audit の Windows 追記修正（O_APPEND の位置指定）は 2.11.1 でも未修正のため再適用した。Cursor adapter の PR #43 パッチ（進行中の作業がないときはガードを走らせない）も再適用した。上流は「落ちたガードは何も拒否しない」に変わったが、毎回のガード起動を省く点は残るため維持した。`scripts/workflows-shell-overrides.json` のハッシュを更新。
- `.claude/rules/aidlc.md` の @-import は、エンジンがセッション開始時に書く git 対象外のコピー `aidlc/active-memory/` を指すようになった。エンジンと Guide が読む手順の正本は引き続き `aidlc/spaces/<space>/memory/`。
- **reader**:
  - 設定の `flags.statusline`（on / off / kept）と `flags.statuslineReplaced` を受け付ける。2.11.1 は Claude Code と Codex で状態行の選択を `aidlc.settings.local.json` に記録するため、未対応のままではトークン・コストの表示が消えていた。
  - 他は「reader の追随」の節を参照。
- **プラグイン**: 2.11.1 の `plugin build` は、AI-DLC が同梱しないプラグインをマニフェストの `name`（focus）で出力する（旧 `aidlc-focus`）。「プラグイン」画面の同梱パッケージ検査を新しい名前に合わせ、カタログを再生成した。`plugin sync` は合成できなかった場合に自ら失敗するようになったため、結合テストの期待を合わせた（画面側のグラフ検査は予備として残す）。
- **Doctor**: 新しい診断の日本語訳を追加した（`active space method copy`、`Plugin marketplace`、Kiro Workflows / ターミナル、Kiro の Agent Hooks、返答が記録されていない警告、依頼フォルダー、Workspace records の新しい文言、Session model の新しい行、opencode の省略形の注意、Workspace source boundary の新しい対処文など）。既存の `Session model ... at <effort> effort (<preset>)` が `extra-high` に一致しなかった点も直した。
- 公式インストーラーの引数（`--version`・`--yes`・`--json`）は変わらず、拡張からの導入は互換。`--allow-root` は使わない（root での導入は従来どおり拒否される）。

## Doctor の採取

2.11.1 では、更新確認を一度もしていないマシンは警告ではなく正常（`Update: not checked yet …`）になった。採取の warning シナリオを、古くなった更新確認キャッシュ（`checkedAt` を 2000-01-01 に固定）に変えた。上流の Machine 節の分類に `Plugin marketplace` が加わったため、採取スクリプトの分類も合わせた。

Linux の 9 ケースを手元で採取して 2.11.1 の契約（依存ソースの指紋 78 ファイルの変更を確認）と共に登録し、[CI 実行 39710190933](https://github.com/otomatty/aidlc-guide/actions/runs/39710190933)（doctor-record）で 3 OS × 9 ケース、計 27 ケースを採取・検査・登録した（`e8a84d1`）。出力の捏造や旧版 fixture の版番号だけの置換は行っていない。

## 文書

- 英語 87 ページを同期し、新規 1 ページ（2.11.1 の更新履歴）を追加。日本語は変更のあった全ページを英語の差分と全文で照合して更新し、2.11.1 の更新履歴を追加した。
- 各ページで見出し数・表の行数・コードフェンス数と、内部リンク・アンカーを英語と照合した。
- `official-docs.translations.json`（人間の翻訳承認）は変更していない。
