# Performance Requirements — Unit: dashboard-server

> nfr-requirements (3.2) / Unit: dashboard-server / 2026-07-24
> 入力: functional-design/business-logic-model.md + requirements.md（NFR-2/3）+ project.md Decided（段階的初回描画）+ reader-core の P-RC 予算

## NFR-2/3 のサーバ分担（reader 予算との積み上げ）

| ID | 要件 | 測定 |
|----|------|------|
| P-DS-1 | **起動→listen 開始（第1段可能時点）≤1秒**（dist チェック + reader/bridge 初期化。NFR-2 の 3秒予算 = サーバ起動 1s + SPA ロード・/api/workflow・描画 2s の配分。**/api/workflow は ≤300ms**: getWorkflow [P-RC-1 の readState ≤100ms] + getNextStep [同モデルからの導出だが独立呼出のため再パース最悪 ≤100ms] + 直列化 ≤100ms。ハンドラ内で1回のパース結果を両者に使う実装なら実測はさらに短い） | 起動計測 |
| P-DS-2 | **第2段（背景 getMatrix→matrix-ready push）は listen 後 3秒以内**に完了 @ tb-lxp（reader P-RC-2a の 2s + 直列化/送出。first paint 後なので NFR-2 非拘束、体感目標） | 計測 |
| P-DS-3 | **変更→broadcast 送出まで ≤1.5秒**（reader 分 ≤1.0s [P-RC-4] + 直列化・送出 ≤0.5s。NFR-3 の 2秒予算からクライアント描画 0.5s を残す） | 計測（WS メッセージ到達時刻） |
| P-DS-4 | WS broadcast はクライアント10接続（モブ規模）でファンアウト遅延を無視できる（同期 send ループで十分） | 設計検査 |
| P-DS-5 | 静的配信は Bun.serve の file 応答（ストリーム）。SPA アセットに Cache-Control（immutable ハッシュ名）を付け再訪ロードを短縮 | 設計検査 |

## 予算整合の検算

NFR-2: 起動 1.0s + SPA ロード 1.0s + /api/workflow 0.3s + 初回描画 0.7s = 3.0s ✓（全走査は含まない — 段階的初回描画）。NFR-3: reader ≤1.0s [P-RC-4] + サーバ直列化・送出 ≤0.5s + UI 描画 ≤0.5s = 2.0s ✓。

## Review

**Verdict:** READY

- P-DS-1: `/api/workflow` budget now explicit at ≤300ms = getWorkflow (≤100ms) + getNextStep (≤100ms, worst-case independent reparse) + serialization (≤100ms), with a note that a single-parse-reused implementation measures faster. NFR-2 checksum re-sums to 1.0 + 1.0 + 0.3 + 0.7 = 3.0s, matching the stated 3s budget.
- S-DS-4 (security-requirements.md): now correctly distinguishes `/api/artifact` (double-check: reader.readArtifact primary + server guardPath) from `/api/answer` (single check point: AnswerWriter's internal guardPath only, writes bypass the reader), explicitly noting no room for a second check on that path. The prior false "both double-checked" claim is removed.
- R-DS-5 (reliability-requirements.md): concrete Windows rename mitigation added — one retry with short backoff on EPERM (locked-file case), fail-500 `write-verification-failed` preserving the original file if retry fails (same invariant as R-DS-2), tmp file created in the same directory to avoid cross-volume EXDEV.
- Regression: cross-checked S-DS-3/R-DS-2 (AnswerWriter atomic write), S-DS-1/Mandated --host rule, P-DS-2/P-DS-3 vs NFR-3 checksum — no new contradictions.
