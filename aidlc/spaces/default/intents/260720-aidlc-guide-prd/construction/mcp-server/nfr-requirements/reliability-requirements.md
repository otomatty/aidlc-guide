# Reliability Requirements — Unit: mcp-server

> nfr-requirements (3.2) / Unit: mcp-server / 2026-07-24
> 入力: functional-design（BR-MS-3/5・写像表）+ requirements.md（NFR-6）

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| R-MS-1 | **プロセスを落とさない**: 全ハンドラの想定外例外を通常応答（内部エラー文）に正規化。未捕捉例外での終了ゼロ（常駐が切れると Claude Code 側の全ツールが失われる — BR-MS-5） | 例外注入テスト |
| R-MS-2 | **データ失敗は通常応答**（isError は入力スキーマ違反のみ — BR-MS-3）。unsupported/error/warnings が AI に読める日本語で伝わる | 分岐テスト |
| R-MS-3 | 起動時に workspace が未初期化（インテント無し）でも起動成功し、各ツールが「インテント未作成」を返す（起動失敗にしない） | 空ワークスペーステスト |
| R-MS-4 | インテント切替に追従（reader が呼出毎に recordDir 再解決 — キャッシュしないことが要件） | 切替テスト |
| R-MS-5 | 両OS動作（stdio・パス — NFR-4） | OS別スモーク |

## 依存の可用性

reader-core / docs-bridge は同プロセス内ライブラリ。外部プロセス依存なし。
