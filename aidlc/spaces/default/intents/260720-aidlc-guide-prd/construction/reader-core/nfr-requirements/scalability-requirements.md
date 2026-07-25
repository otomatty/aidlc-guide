# Scalability Requirements — Unit: reader-core

> nfr-requirements (3.2) / Unit: reader-core / 2026-07-24
> 入力: performance-requirements.md（P-RC-1〜5）+ requirements.md（NFR-5: ローカル・ファイルが真実）

## データ量軸（ローカルツールの「スケール」= 記録サイズ）

| ID | 要件 | 検証 |
|----|------|------|
| SC-RC-1 | 設計基準は tb-lxp 規模（**約600ファイル・1インテント**）。この規模で P-RC-1〜4 を満たす | tb-lxp ベンチ（P-RC と同一） |
| SC-RC-2 | 2倍規模（~1200ファイル）でも劣化は線形以下（アルゴリズムは全て O(n) 単走査 — ソート除く audit マージ O(n log n)） | 合成 fixture（tb-lxp 複製）でのスポットベンチ |
| SC-RC-3 | インテント数・スペース数は列挙のみ（各 readdir 1回）。数十件で劣化しない | unit テスト |

## 非該当

同時ユーザー・水平分散・シャーディングは対象外（単一プロセス内ライブラリ、消費者は同時2プロセス [mcp/dashboard-server] まで — services.md。各自が独立に読むだけで協調不要）。
