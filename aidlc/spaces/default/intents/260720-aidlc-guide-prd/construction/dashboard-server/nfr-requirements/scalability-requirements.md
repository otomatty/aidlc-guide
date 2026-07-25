# Scalability Requirements — Unit: dashboard-server

> nfr-requirements (3.2) / Unit: dashboard-server / 2026-07-24
> 入力: performance-requirements.md + services.md（モブ規模）

## 適用範囲

| ID | 要件 |
|----|------|
| SC-DS-1 | 同時接続はモブ規模（~10 クライアント）を設計上限とし、P-DS-4 のファンアウトで対応。それ以上（数十〜）は非目標（社内モブの実態にない） |
| SC-DS-2 | データ量スケールは reader-core の SC-RC に委譲（サーバは透過） |

## 非該当

水平分散・複数プロセス・セッション管理なし（単一ローカルプロセス — services.md）。
