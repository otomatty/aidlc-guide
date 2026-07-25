# Performance Requirements — Unit: dashboard-ui

> nfr-requirements (3.2) / Unit: dashboard-ui / 2026-07-24
> 入力: functional-design/business-logic-model.md（取得フロー・5状態）+ requirements.md（NFR-2/3）+ dashboard-server P-DS 予算

## NFR-2/3 の UI 分担（サーバ予算との積み上げ）

| ID | 要件 | 測定 |
|----|------|------|
| P-UI-1 | **SPA ロード（HTML 受信→JS 実行開始可能）≤1.0秒**（NFR-2 の 3秒配分: サーバ起動 1.0s + SPA ロード 1.0s + /api/workflow 0.3s + 初回描画 0.7s）。バンドルは code-split（matrix/viewer は遅延）で初期 JS を小さく保つ | Lighthouse/手動計測 |
| P-UI-2 | **初回描画（/api/workflow 応答→NowStrip+StageRail 可視）≤0.7秒**（React 初回マウント + トークン適用） | 計測 |
| P-UI-3 | **変更反映（WS 受信→再描画完了）≤0.5秒**（NFR-3 の 2秒配分: reader 1.0s + サーバ 0.5s + UI 0.5s）。scope 別に該当 slice のみ更新し全体再描画しない | 計測 |
| P-UI-4 | matrix 描画は**セル数 500 まで**仮想化なしで ≤300ms（現実規模: ユニット数 数十 × Construction ステージ 5 = 数百セル。SC-UI-2 の見積り上限と同一レンジをベンチ対象とする） | ベンチ（100/300/500 セルの3点計測） |
| P-UI-5 | loading スケルトンは 200ms 閾値（それ未満はちらつき防止で出さない — BLM の判定ロジック） | タイマーテスト |

## 予算整合

NFR-2: 1.0（サーバ起動）+ 1.0（SPA）+ 0.3（API）+ 0.7（描画）= 3.0s ✓
NFR-3: 1.0（reader）+ 0.5（サーバ）+ 0.5（UI）= 2.0s ✓

## Review

**Verdict:** READY

- **予算積み上げの検算（criterion 1）**: dashboard-server/nfr-requirements/performance-requirements.md の P-DS-1/P-DS-3 と本ファイルの数値は完全一致し、二重計上・欠落なし。NFR-2 = サーバ起動 1.0s（P-DS-1）+ SPA ロード 1.0s（P-UI-1, UI 分担）+ /api/workflow 0.3s（P-DS-1 の内訳）+ 初回描画 0.7s（P-UI-2, UI 分担）= 3.0s、dashboard-server 側の検算行「起動 1.0s+SPAロード1.0s+/api/workflow 0.3s+初回描画0.7s=3.0s」と数値・内訳の帰属（どちらが何を担うか）まで一致。NFR-3 = reader 1.0s（P-RC-4, 本 Unit 外）+ サーバ 0.5s（P-DS-3 の残 0.5s と明記一致）+ UI 0.5s（P-UI-3）= 2.0s、dashboard-server の P-DS-3 注記「NFR-3 の2秒予算からクライアント描画0.5sを残す」とも整合。両者は同じ 4 分割を別ファイルで独立に導出しているが数値の食い違いなし。
- **[Non-blocking] P-UI-4 と scalability-requirements.md SC-UI-2 のセル数見積りが不一致**: P-UI-4 は matrix セル数を「ユニット×ステージ ≒ 数十〜百セル」と見積り、この規模を根拠に「セル数が小さいため」仮想化なしで ≤300ms としている。一方 SC-UI-2 は同じ量（ユニット数 × Construction ステージ数）を「現実的に 数十×5 = 数百セル以下」と見積り、この見積りの上で「（P-UI-4）」を根拠として仮想化不要と結論している。しかし SC-UI-2 自身の算出結果（数百セル）は P-UI-4 が実際にベンチ対象とした範囲（数十〜百）の上限を超えうる — P-UI-4 の ≤300ms は「セル数が小さい」という前提の範囲でしか裏付けられておらず、SC-UI-2 が P-UI-4 を根拠として引用している「数百セル」規模ではベンチマークされていない。SC-UI-2 には 50 ユニット超で仮想化を再検討するトリガーが既にあるため実装をブロックするものではないが、両ファイルの見積り自体を一致させるか、P-UI-4 の ≤300ms 主張がどのセル数レンジまで有効かを明記すべき。
- **security/reliability/tech-stack の整合**: S-UI-1/2/3 は BR-UI-7（書込 UI なし）・BR-UI-1（reader-core 非 import）・Unit 境界（Markdown 表示は artifact-viewer Unit）と1:1で対応し矛盾なし。R-UI-1〜6 は business-logic-model.md の5状態判定ロジック・再接続（指数バックオフ1s→10s、数値まで一致）・エラーハンドリング文言と対応し、BR-UI-3/4/5 とも整合。tech-stack-decisions.md の CSS カスタムプロパティ方式は design-system-mapping.md の Q3-A 方針と、Radix 最小プリミティブ採用は accessibility-checklist.md の FocusScope trapped=false / DismissableLayer 記述と対応しており、refined-mockups の決定と矛盾しない。
- 5 ファイルとも H2 見出し ≥2 と upstream 入力の明記（ヘッダ引用行）を満たす。
