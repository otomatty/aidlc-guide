# Reliability Requirements — Unit: dashboard-server

> nfr-requirements (3.2) / Unit: dashboard-server / 2026-07-24
> 入力: functional-design（AnswerWriter/伝搬）+ requirements.md（NFR-6）+ reader-core R-RC

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| R-DS-1 | reader/bridge の縮退（unsupported/error/warnings）を 500 にせず UI 表示可能なペイロードで透過（BR-DS-4。サーバ起因の想定外のみ 500） | 写像テスト |
| R-DS-2 | AnswerWriter は atomic（tmp+rename）+ 書込前検証。失敗時は元ファイル無傷（クラッシュ耐性: tmp が残っても本体は壊れない） | クラッシュ注入テスト |
| R-DS-3 | WS 切断はサーバ継続に影響しない（クライアント再接続で REST 初期取得から復帰 — プロトコル設計どおり）。watch-warning は live-status で全クライアントに透過 | 切断テスト |
| R-DS-4 | 起動時 dist/ 不在の扱い（**段階的**）: **dashboard-ui 出荷前**は明示ログ付きの API-only モードで起動（本 Unit を独立に実行・テスト可能にするため。`distDir` は設定可能 — code-generation D-1）。**dashboard-ui 出荷後**は明示エラーで fail fast に戻す（黙って空白ページを出さない — ビルド時契約）。どちらの段階でも「黙って空白を返す」ことは禁止 | 起動テスト（両モード） |
| R-DS-5 | 両OS動作（bind・パス・rename の挙動差）。**Windows の rename 上書き対策**: node/bun の fs.rename は MoveFileEx(REPLACE_EXISTING) 相当で既存宛先を上書きできるが、対象ファイルを他プロセス（エディタ/ウイルススキャン）が開いていると EPERM になり得る — 失敗時は 1回だけ短い backoff 後に再試行し、それでも失敗なら 500 {error:"write-verification-failed"} で元ファイル無傷を保証（R-DS-2 と同じ不変量）。tmp は同一ディレクトリに作る（別ボリューム rename の EXDEV 回避） | OS別スモーク（rename 競合ケース含む） |

## 依存の可用性

reader-core/docs-bridge はライブラリ（同プロセス）— 可用性は自プロセスと同一。外部プロセス依存なし。
