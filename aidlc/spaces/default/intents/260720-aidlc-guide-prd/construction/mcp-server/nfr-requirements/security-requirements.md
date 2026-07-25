# Security Requirements — Unit: mcp-server

> nfr-requirements (3.2) / Unit: mcp-server / 2026-07-24
> 入力: functional-design/business-rules.md（BR-MS-1〜6）+ requirements.md（NFR-1）+ project.md Mandated

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| S-MS-1 | 書込 API ゼロ（5ツール全て読取。write 系 fs import なし — Biome 構造禁止） | lint + import 走査 |
| S-MS-2 | read_artifact の記録境界: reader-core の公開 guardPath をサーバ前段でも呼ぶ + reader 内部一次（同一実装の二重呼出） | 3ベクタテスト |
| S-MS-3 | stdio のみ（ネットワーク listen なし）。トランスポートは Claude Code との標準入出力に限定 | 設計検査 |
| S-MS-4 | 応答にワークスペース外の情報を含めない（エラー時も絶対パスの露出を最小化 — 相対パス表記） | エラーパステスト |
| S-MS-5 | 資格情報を扱わない（Claude Code 側の認証に非関与） | コードレビュー |

## 脅威メモ

攻撃面は「AI が渡す path 引数」1点（S-MS-2 で遮断）。stdio 常駐でネットワーク面ゼロ。規制データなし（C-R1）。
