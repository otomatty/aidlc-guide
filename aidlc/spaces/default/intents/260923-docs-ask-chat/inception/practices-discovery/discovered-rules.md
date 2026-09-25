# Discovered Rules（統合）

> 人間が述べた硬制約、および既に肯定済みで貢献が Mandated 扱いとした条項のみ。履歴の共有数値は未確定のため硬規則にしない。専用 SAST／DAST／secret scanner の新 Mandated は追加しない。

## Mandated

- ALWAYS `aidlc/spaces/<active-space>/` とアプリケーションリポジトリを読み取り専用として扱い、`*-questions.md` への `[Answer]:` 行書き込みだけを例外とする。
- ALWAYS 出荷ランタイムは bun のみとし、データベースや追加ランタイム／プロセスマネージャを導入しない（Vitest 等の開発時ツールは出荷ランタイム外）。
- ALWAYS 品質ゲートの定義は単一の `bun run check` に置き、新しい検査はそこに配線する。呼び出し側（git フック・CI workflow・手順書）はチェック項目を独自列挙しない。
- ALWAYS チャット画面化の UI テストと契約テストを `bun run check` に含める。それらを欠いた変更は通さない。
- ALWAYS クロスプラットフォームのパス API（`node:path` / `vscode.Uri`）を使い、区切り文字をハードコードしない。
- ALWAYS `dashboard` が `reader-core` を import しない状態を保つ。
- ALWAYS 公式同梱 docs は `docs/guide/<locale>/` と `docs/reference/<locale>/` に置き、locale コードは `en` / `ja` とする。
- ALWAYS 公式 docs の HTTP/postMessage API は `/api/official-docs/:locale/*` の下に公開する。
- ALWAYS locale 解決／コンテンツ読込は official-docs 級の **95% branch coverage** を満たす。
- ALWAYS 同梱 docs の読取は locale コンテンツルートに対する `guardPath` を通し、否定 containment テストを `bun run check` に含める。
- ALWAYS docs コンテンツローダは `api-core` / `official-docs` に置き、`reader-core` や `dashboard` には置かない。
- ALWAYS VSIX に秘密情報・`.env`・`aidlc/` ランタイム状態を含めない。
- ALWAYS bun のロックファイル（`bun.lock` / `bun.lockb`）をコミットして供給鎖の真実とする。
- ALWAYS ローカル品質ゲートで `bun audit`（または `bun pm audit`）を実行し、直接依存の既知脆弱性を lint 失敗と同じくゲート失敗とする。
- ALWAYS Mob モード／dashboard-server の既定 bind は loopback（`127.0.0.1`）とし、LAN 露出は明示の `--host` のみとする。`--host` 経路では何を公開しているかを起動警告で示す。

## Forbidden

- NEVER 本ローカル専用ツールにクラウド／AWS サービス依存やアカウント管理機能を追加しない。
- NEVER 本プロジェクトの一部として aidlc-workflows のエンジン／ステージ定義／監査ログ形式を変更しない。
- NEVER `[Answer]:` 例外以外で aidlc の state／audit に書き込まない。
- NEVER 公式 aidlc-workflows の guide+reference ツリーに `/api/guides` や `docs/guides/` を使わない。
- NEVER 連続機械翻訳の自動公開パイプラインを導入しない（ブートストラップ AI 翻訳＋人間の PR 更新のみ）。
- NEVER ドキュメント本文の locale 切替に i18n メッセージカタログライブラリを導入しない（コンテンツツリー切替のみ）。
- NEVER Bridge CTA のために `open-official-doc` と並ぶ並行 Docs 着地口を発明しない。
- NEVER NFR が予算を定めるまで、`bun run check` に VSIX サイズの hard-fail を強制しない。
- NEVER bun 以外の出荷ランタイムやデータベースを導入しない。
