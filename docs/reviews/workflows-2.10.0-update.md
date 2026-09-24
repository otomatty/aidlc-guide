# aidlc-workflows 2.10.0 更新記録

対象は[公式リリース v2.10.0](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.10.0)、SHA `2a883858f5483bce3b48f43b8f6d3ca2c042d6ae`。比較元はmanifestの公式v2.9.0 `22f5d1b15a064c9ae80046e5b1761d5877e2f69f`。タグの参照先コミットを確認し、独立checkoutから両ハーネスの配布物を生成した。開発用checkoutの未公開変更は取り込んでいない。

## 変更内容と互換性

- State Version **8**・基本 **33ステージ**は維持。英語文書・Claude/Cursorシェル・manifest・README・AGENTS・bridge・GUI導入対象を2.10.0に揃えた。拡張自体のpackage.jsonのversionは変更していない。
- Guard Policyの`strict`・`relaxed`・`off`を状態表示とスコープ設定へ反映。旧Change Controlも読み取り、新旧の矛盾・不正値・重複を安全側に扱う。レビュー鮮度はmemoryのstrictを優先し、Markdownのコード表記や折り返した値も上流規則と照合した。画面は実効値と混同しないよう「記録値」と表示する。
- スコープ編集にsensors・learnings・summary_confirmationを追加。旧キーだけが存在する場合はそのキーを編集し、競合する新キーを増やさない。標準スコープの原文と日本語説明を更新し、Expressの3項目offを反映した。
- ConstructionのUnit／バッチcheckpoint、検証コマンドの人間による許可、proofとレビュー保存形式を実コードで比較。レビューJSONのschema v1と監査のID・パス・digest照合は継続する。checkpoint proofを既存のレビュー証拠として代用しない。bridgeの説明とリンクを新しいUnit/skeleton checkpointへ更新した。
- Doctorの新しいscope永続化診断、非ログインPATH案内、任意のParked attempts節を表示。保留した試行は検査件数に加えず、画面ではテキストとして安全に描画する。未知行を消さない挙動は維持した。
- 中立なルートAGENTSとハーネス固有の導入文書の分離を同期。Copilotの排他的なルートAGENTSと、Kiro・Kiro IDE・Codex・Cursorの衝突を導入前に検出する。既存のエンジンディレクトリ衝突も維持する。
- Cursor adapterの既存パッチを旧公式・ローカル・新公式の3者で照合し再適用。配布物比較でローカルパッチ以外の差分がないことを確認した。

## Doctorの実測

[専用CI実行 35981204745](https://github.com/otomatty/aidlc-guide/actions/runs/35981204745)が公式リリースから採取したWindows・macOS・Linuxの各9ケース、合計27ケースを登録した。native/copy、正常・警告・異常、Bun PATH、analysis warning、Kiro providerを含む。

このCI実行全体は、更新前の登録情報による未知のソース指紋と翻訳不足の検出で失敗し、PR公開ジョブは実行されなかった。採取ジョブの実出力を取得し、上流の診断コード・メッセージ依存をレビューしてからレジストリと訳を更新した。更新後のcandidate検査は3 OSとも問題0件。出力の捏造や旧版fixtureの版番号だけの置換は行っていない。

Parked attempts節は追加の合成回帰ケースでparserと件数維持を検証した。実測27ケースが実際のparked worktree復元まで検証しているわけではない。

## 文書

[同期差分](official-docs-diff-2.10.0.md)は追加1・変更56ページ。新規の2.10.0更新履歴と日英の更新ハイライトを収録した。日本語の利用者向けガイドでは、初回設定、provider、ハーネス共存、Guard Policy、Construction、検証コマンド許可、Unit／バッチ承認、worktreeの復元・破棄を更新した。開発者向けのscope・memory・ハーネス移植・モデル継承・Windowsセッション識別なども反映した。

変更した日本語文書の内部リンク672件を画面と同じパス／見出し解決規則で検査し、不一致0件。版に依存する外部原文リンクは、検証した40桁のコミットSHAに固定した。既存のブランチ参照禁止テストは、HEADまたは完全なSHAだけを受け付け、ブランチ・タグ・短縮SHAを引き続き拒否する。

人間の翻訳承認を表す`official-docs.translations.json`は変更していない。未承認訳に対するAI検索の原文へのフォールバックも維持する。

### 日本語詳細資料の残件

次の13ページは差分の全文翻訳を完了していない。ページ冒頭に旧版本文であること、画面の英語切替、対象コミットの原文、更新ハイライトを明示した。英語原文はすべて2.10.0へ更新済みであり、日本語全文の対応完了とは区別する。

- harness-engineering: `08-construction-and-swarm.md`
- overview: `roadmap.md`
- reference: `03-orchestrator.md`、`04-stage-protocol.md`、`04-stages/construction.md`、`04-stages/inception.md`、`06-hooks-and-tools.md`、`09-testing.md`、`11-contributing.md`、`12-state-machine.md`、`17-skill-system.md`、`19-supply-chain-security.md`、`diagrams.md`

## 検証

- `VITEST_MAX_WORKERS=4 bun run check`: 209ファイル・3,565件成功・7件skip。lint・整形・型・索引・strict互換性・監査shard検査を含む。`bun audit`は脆弱性なし。
- 公式タグに対する`check-workflows-drift`: findings **0**、blocking **0**。`check-bundled-shells`も成功。
- 成果物map・検索索引を再生成。英語／日本語の説明122件、表の行順65/65一致。上流に説明がない6成果物はそのまま欠落を表示する。
- `bun run package:extension`: 成功。VSIX内の文書506ファイルを作業ツリーとバイト照合し、生成する`guides.version.json`が拡張の現行版0.31.5と一致することを別途確認した。文書計507ファイル、日本語103ページ。Dashboard・extensionの生成物127ファイルも一致した。
- ローカルDashboard SPAで2.10.0更新履歴の日本語／英語切替、カスタマイズのExpress詳細にGuard Policy relaxedと3つの手続きoffが表示されることを確認。標準設定は閲覧のみのまま確認し、利用者の設定は保存していない。検証後にブラウザーとサーバーを閉じた。

VS Code／Cursorの実拡張ホストにおけるネイティブ導入操作は未検証。利用中エディターへのインストール、マージ、公開は行っていない。
