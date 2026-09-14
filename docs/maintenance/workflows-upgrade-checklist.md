# aidlc-workflows 更新チェックリスト

AI は版上げの調査・実装前にこのファイルを読み、確認した差分・残件・検証結果を更新する。チェック済みは実装と検証が完了した項目だけに付ける。同期の具体的な手順は [release-and-sync.md](release-and-sync.md) を参照。

毎回確認すること:

- 比較元は `docs/official-docs.manifest.json` の `upstreamSha`、比較先は対象の公式リリースのタグ・SHA。作業中 checkout の HEAD や版番号だけで判断しない。
- 上流の配布物を生成して `bun scripts/check-workflows-drift.ts --upstream <対象checkout>` を実行する。State Version・ステージ・エージェント・導入版・Doctorの検査結果を確認する。レビュー保存形式、監査フィールド、変更監視は実コードでも比較する。`blocking=0` だけでは互換性を保証しない。
- レビュー判定は、strictの成果物・ソース変更、Bolt再開、複数Stageの却下、別shardの同時刻イベント、unit-majorの補完イベントを回帰確認する。効果測定でも要求・完了のソース指紋を照合し、Doctorの診断コード全種に訳があるか確認する。監視解除前後の通知を区別し、Windowsの一時パスを比較するテストは実装と同じrealpathを使う。
- ソース・設定変更の実ファイル監視から画面通知・キャッシュ更新までを検証する。再計算中の接続と、古い非同期結果による判定の復活も確認する。
- Unit DAGの解析は上流の受理形式と照合する。引用符付きのname・kind・depends_on、配列／ブロック形式、古いruntime cacheがある場合を回帰確認する。
- docs・`.claude/`・`.cursor/` を同じ対象へ同期し、ローカルパッチを確認する。READMEの全版表記、AGENTSの宣言、docs-bridgeの版・説明本文・テスト、独自の `release-highlights.md` は手動確認する。bridge-map更新後に `bun run build:artifact-map`、文書・訳文更新後に `bun run build:docs-index` を実行する。
- 日本語は対象版の英語本文全体と照合し、過去から残る「翻訳の更新待ち」と日本語未作成のページも棚卸しする。見出し・表の行順・コード・識別子・リンクを確認し、反映後に注記を外す。見出しリンクは実際の日本語見出しのslugへ合わせる。新しい上流訳を再利用するときも、対象版より後の機能を混入させない。人間の確認を表す `official-docs.translations.json` の承認ハッシュは、AIの照合だけで記録しない。
- 変更箇所の回帰テスト、`bun run check`、`bun run package:extension`、VSIXの動作確認を行う。拡張の `package.json` の版は手動変更せず、既存のリリースラベル規約に従う。

v2.8.2 対応結果（2026-09-14）:

対象は [公式v2.8.2](https://github.com/awslabs/aidlc-workflows/releases/tag/v2.8.2)、SHA `355903d6dc8eb07d3c77180be5d40ed679d6a40f`。docsは2.8.0、導入版は2.8.1から更新。

- [x] `packages/shared-types/src/workflows-management.ts` の `WORKFLOWS_TARGET_VERSION` とdocsを2.8.2に統一。`native-setup.ts` の `SETUP_RELEASE` はこの共通値を参照する。manifestだけ上げると更新が `pin-ahead` で拒否されるため、両方を揃える。
- [x] `packages/vscode-extension/src/doctor-output.ts` に2.8.2を追加し、`doctor-messages-ja.ts` の新診断・対処文を翻訳。正常・警告・異常と、ソース診断15コード・38理由を検証。
- [x] readerの `tree/review-records.ts`・`matrix.ts` でJSONレビューと監査の `Request Id`・パス・SHA-256を照合。旧Markdown読み取りを維持し、`watch/watcher.ts`・`packages/api-core/src/push.ts` で更新を即時反映。
- [x] readerの `effectiveness/events.ts`・`derive.ts` で要求IDと要求・完了・Unitのソース指紋を照合。別要求、Unit・attempt・Workflowの混同、欠損・不一致・古いレビューを回帰検証。
- [x] 英語公式文書・版表記・更新履歴・検索索引・成果物説明を同期。日本語の導入手順とCLI・Plan Approvalの主要差分、日英の `release-highlights.md` を更新。上流に含まれる2.8.6は未公開履歴と明記。
- [x] `.claude/`・`.cursor/` を同期し、ローカルパッチを維持。テスト用環境で新規導入・2.8.0／2.8.1からの更新とhook重複防止を検証。
- [x] Change Controlの値と設定元を型・parser・画面に追加。「記録値」と表示し、memoryの上位設定を含む実効値とは区別。
- [x] drift検査に導入対象版とDoctor対応版のずれを検出するadvisoryを追加。
- [x] 日本語の更新待ち63ページをv2.8.2原文と全文照合し、注記を解消。導入・更新管理、リリースの安全性、スコープ案内の日本語ページを追加。見出しリンク63か所と成果物表の対応も確認。過去リリースの履歴原文は英語を維持し、主な変更は日本語の `release-highlights.md` で案内する。
- [x] PR #97のレビュー指摘を反映。strictでは現行の成果物・ソース指紋も照合し、memoryのstrict指定を優先する。Bolt再開・複数Stage却下で判定を消し、別shardの同時刻から前後関係を推定しない。unit-majorの正常完了時は判定を維持する。
- [x] ソース・state・memory・ステージ定義の変更でも判定を再計算し、画面通知と再読み込み用キャッシュを更新。非同期処理の順序と起動時の計算競合を回帰検証し、古いREADYが戻らないことを確認。
- [x] 引用符付きUnit DAGで有効なREADYが消える問題を修正。name・kind・依存先の引用符を上流と同じ規則で除去し、不正な名前・依存先・循環は引き続き拒否する。

検証: レビュー9件の修正後に `VITEST_MAX_WORKERS=4 bun run check` 成功（**167ファイル・2,898件成功・6件skip**）、依存関係の脆弱性なし。固定v2.8.2とのdrift **0件**。VSIXを再生成し、日本語100ページが作業ツリーと一致、更新待ち注記0件を確認。本体更新時は一時プロファイルのCursor拡張ホストで、同梱docs 2.8.2・セットアップ／更新画面を確認済み。利用中のエディターへのインストール・公開は未実施。

main `6db0b7b` 取り込み時の7ファイルの競合は、main側の導入処理の修正と2.8.2対応を保持して解消済み。

補足: 日本語本文の照合はAIが実施。人間の翻訳承認ハッシュは未登録のため、AI検索が原文へ戻る既存仕様は維持。Change Control設定変更UIとPreview導入は今回の対象外。

レビュー表示の制約: strictでローカルのステージ定義が未配置・欠落している環境、複数repo・worktree等の未対応ソース構成、読み取り上限超過は判定を表示しない。通常の単一repoではソース・設定変更を監視して再計算する。未対応構成の拡張は継続課題。

State Version **8**・基本ステージ **33** は維持。番号変更・状態移行は不要。
