# Security Requirements — Unit: mob-mode

> nfr-requirements (3.2) / Unit: mob-mode / 2026-07-25
> 入力: functional-design（BR-MM-1〜7 + 受入条件）+ requirements.md（NFR-7）+ project.md Mandated + decisions.md ADR-04
> 本 Unit はシステム唯一のネットワーク公開面。要件は「U5 実装への制約（本 Unit が検証責任を持つ）」と「本 Unit 自身の作業」に分かれる。

## 要件

| ID | 要件 | 実装所有 | 検証 |
|----|------|---------|------|
| S-MM-1 | 既定 bind は 127.0.0.1。LAN 公開は `--host` 明示時のみ（環境変数・設定ファイルで暗黙有効化しない） | U5 | 別端末からの到達性テスト（既定=不可 / --host=可） |
| S-MM-2 | `--host` 時は公開対象を名指しした警告を必ず出す（「成果物」「監査」「秘密を含み得る」相当の語を含む） | U5（文言）+ 本 Unit（アドレス併記） | 文言の必須語アサーション |
| S-MM-3 | hostMode 中の書込は接続元によらず無条件 403（IP/UA で分岐しない） | U5 | curl 直叩きテスト |
| S-MM-4 | **待受アドレス表示に内部情報を混ぜない**（列挙するのは外部到達可能な IPv4 + ポートのみ。ホスト名・ユーザー名・パスを出さない） | 本 Unit | 出力内容のアサーション |
| S-MM-5 | 認証を実装しない代わりに**公開の可視性**を最大化する（起動警告[**文言は U5 所有** — S-MM-2] + アドレス一覧[本 Unit] + 参加者ビューの ReadOnlyBadge[本 Unit]）。可視性という**結果**の担保が本 Unit の責務で、警告文字列自体は U5 の単一実装を使う（複製しない — BR-MM-4） | 本 Unit（アドレス一覧・バッジ）／ U5（警告文言） | 受入条件（functional-design） |
| S-MM-6 | 公開状態は実行中に変化しない（トグル API なし。変更はプロセス再起動のみ） | 本 Unit + U5 | **dashboard-server functional-design/business-logic-model.md の「REST ハンドラ」表と domain-entities.md の `WsMessage` union** に hostMode 切替経路が無いことの検査（両者が全 API 面） |

## 脅威メモ

`--host` は**データ開示イベント**（ポート開放ではなく）。同一 LAN の全端末が aidlc 成果物・監査内容を読める。統制手段は「明示フラグ + 具体的警告 + 可視バッジ」の3点のみで、認証はスコープ外（トンネル公開時の認証注意は ops-guides — NFR-7）。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-07-25 (iteration 2, final)

- **S-MM-5 vs S-MM-2 ownership contradiction (blocking, iteration 1) — resolved.** S-MM-5 now reads: 起動警告の**文言は U5 所有 — S-MM-2** と明示し、「可視性という結果の担保が本 Unit の責務で、警告文字列自体は U5 の単一実装を使う（複製しない — BR-MM-4）」と続ける。実装所有列も「本 Unit（アドレス一覧・バッジ）／ U5（警告文言）」に分割済み。S-MM-2 の実装所有（U5＝文言／本 Unit＝アドレス併記）と完全に一致し、`business-logic-model.md` のオーナーシップ表の行1（bind 分岐と公開警告文字列の出力 = U5「起動シーケンス」）とも整合する。単一実装の主張とこの Unit 自身の可視化責務（アドレス一覧・ReadOnlyBadge）が両立し、二重仕様は解消されている。
- **Reliability table missing ownership column (blocking, iteration 1) — resolved.** `reliability-requirements.md` に「実装所有」列が追加され、規約注記（"security-requirements.md と同じ規約"）で本 Unit の要求・検証役割を明示。R-MM-1（bind 失敗時の起動失敗）は U5（bind 分岐）に帰属し、BLM オーナーシップ表の行1と一致。R-MM-4（切断・再接続の非影響）は U5（WS クライアント管理）に帰属し、BLM の「全クライアント同一の WS broadcast＝U5: BR-DS-6」と整合する（broadcast 実装がクライアント集合の管理を内包するのは自然な帰結）。R-MM-5（参加者ビュー復帰）は U6（dashboard-ui）に帰属し、dashboard-ui 自身の R-UI-4 を名指しで参照している。一方 R-MM-2（NIC 列挙失敗時の継続起動）・R-MM-3（LiveStatus の真実性）は本 Unit 所有のまま — BLM の「エラー・境界」節および M3 LiveStatus 節と一致し、U5 所有行が本 Unit のタスクとして誤読される余地はなくなった。
- **S-MM-6 unresolvable "API 表" (non-blocking, iteration 1) — resolved.** 検証欄が「dashboard-server functional-design/business-logic-model.md の『REST ハンドラ』表と domain-entities.md の `WsMessage` union に hostMode 切替経路が無いことの検査（両者が全 API 面）」に具体化された。ファイル名・セクション名・型名まで特定されており、開発者が追加の問い合わせなしに検証を実行できる。サイバー参照先ファイルの中身検査自体は本レビューの read-scope 外（dashboard-server の construction 成果物は対象外）だが、参照の具体性という欠陥は解消されている。
- **Scalability missing verification column (non-blocking, iteration 1) — resolved.** `scalability-requirements.md` に「検証」列が追加され、SC-MM-1 は「10接続での反映時間が NFR-3 内（performance-validation 4.6）」、SC-MM-2 は「接続数上限のチェックコードが存在しないこと + LiveStatus の表示要素に接続数が含まれないこと」と具体的な検証手段を持つ。
- **Regression** — 新たな矛盾なし。security / reliability / scalability の3表とも実装所有・検証の両列が揃い、`business-logic-model.md` のオーナーシップ表（bind 分岐＋警告文言／`serverMode.hostMode`／無条件403／WS broadcast＝U5）と全行が整合する。本 Unit 所有の行（S-MM-4/5[アドレス・バッジ]/6、R-MM-2/3、SC-MM-2）はいずれも BLM の M1〜M3 または「エラー・境界」節に対応する実装記述を持つ。
