# Security Requirements — Unit: dashboard-server

> nfr-requirements (3.2) / Unit: dashboard-server / 2026-07-24
> 入力: functional-design/business-rules.md（BR-DS-1〜7）+ requirements.md（NFR-1/7）+ project.md Mandated

## 要件

| ID | 要件 | 検証 |
|----|------|------|
| S-DS-1 | 既定 bind 127.0.0.1。0.0.0.0 は --host のみ + 公開対象を名指しした警告（US-19 の文言そのまま） | bind テスト + 警告文言検証 |
| S-DS-2 | --host 中の /api/answer 無条件 403（UI 迂回の直接 POST も遮断 — US-11 のサーバ側担保） | 直接 POST テスト |
| S-DS-3 | 書込は AnswerWriter 7ステップのみ。ファイル名パターン・guardPath・Answer 行・byte-invariance の4ゲート全通過が条件 | ゲート組合せテスト |
| S-DS-4 | パス系入力の検査点: **/api/artifact は二重**（reader.readArtifact 内の一次 + サーバ側 guardPath）、**/api/answer は AnswerWriter 内の guardPath 1回が唯一の検査点**（書込は reader を経ないため — S-DS-3 の4ゲートの一部。二重化の余地がない経路であることを明示）。拒否は 403/404 で理由を返すが内部パスを晒さない | 3ベクタテスト（両エンドポイント） |
| S-DS-5 | 認証は持たない（スコープ外 — PRD §8。トンネル時の認証は運用ガイド F-08 の注意喚起） | — 明示 |
| S-DS-6 | WS にも書込系メッセージを定義しない（WS は push 専用・受信は無視。書込は HTTP POST 1経路のみ） | プロトコル検査 |

## 脅威メモ

攻撃面: HTTP/WS の listen（既定 loopback で局所化）+ file/path パラメータ（S-DS-4）+ answer 書込（S-DS-3）。--host 時は同一 LAN の全端末が読取可能になる — これは機能仕様（FR-7.1）であり、警告（S-DS-1）とガイド（F-08）で統制。
