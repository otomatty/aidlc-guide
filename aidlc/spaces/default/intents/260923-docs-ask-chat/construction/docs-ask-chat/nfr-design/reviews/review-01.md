## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-09-24T08:01:00Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | aidlc/spaces/default/intents/260923-docs-ask-chat/construction/docs-ask-chat/nfr-design/security-design.md > NFR3.1; logical-components.md > 会話の保存 / 質問の処理 | NFR3.1 は会話の読み書きを「質問を処理する側」に置き、logical-components は質問の処理を `packages/api-core` の docs-qa に固定している。一方、保存先は `ExtensionContext.globalState` であり、現行コードでは vscode-extension 側の API である（locale 等の既存利用）。api-core に `ExtensionContext` を持たせる設計は技術スタックと衝突し、実装者がパッケージ境界を推測せざるを得ない。 | 会話の永続化の所有者を `packages/vscode-extension`（または明示したホスト橋）に書き換え、api-core は進行中ジョブのみと境界を一文で切る。security-design の「質問を処理する側」表現をその所有者に合わせて直す。 | New |
| R-02 | Major | aidlc/spaces/default/intents/260923-docs-ask-chat/construction/docs-ask-chat/nfr-design/performance-design.md > NFR2.1 | NFR2.1 は `vitest.config.ts` の `coverage.thresholds` に docs-qa 向け `branches: 70` を足すと書くが、既存 95% ブロックのような具体パス（例: `packages/api-core/src/docs-qa/**`）が無い。実装者が dashboard・api-core・別グロブのどれを閾値キーにするか決められない。 | NFR2.1 の対象を既存ブロックと同じ形式のパスキーで固定し、traceability.json の target もそのパスに合わせる。 | New |
| R-03 | Minor | aidlc/spaces/default/intents/260923-docs-ask-chat/construction/docs-ask-chat/nfr-design/reliability-design.md > NFR3.1 | 件数上限も溢れ時の規則も無いため、`globalState` 上のターンが無制限に増えうる。ローカル拡張としては許容し得るが、長期利用での肥大化が未検討である。 | 意図的な無制限ならその旨を一文残すか、上限／古いターンの扱いを決めて書く。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| date -u (review timestamp) | BLOCKED by review-freeze PreToolUse | タイムスタンプはディスパッチ時刻（UTC+9 17:01 → `2026-09-24T08:01:00Z`）を使用 |
| stage sensors / shell validators | BLOCKED by review-freeze PreToolUse | センサ実行は不可。手動照合で代替 |
| manual: vitest.config.ts coverage.thresholds | PASS for claimed-existing 95% blocks | NFR2.2 が残すとする reader-core parse / official-docs resolve・roots・markdown の 95% キーは実在。NFR2.1/2.3 の 70/80 は未存在で、設計の「足す」表現と一致 |
| manual: api-core docs-qa hostMode / busy | PASS | ask/job/cancel/evidence の host-mode 拒否と進行中 `busy` 拒否は `packages/api-core/src/docs-qa/index.ts` に実在。スケール／信頼性の「既存」単一ジョブ主張は裏付けあり |
| manual: DocsQaResult / guardPath / features/docs / hostMode UI | PASS | `DocsQaResult`・official-docs 経由の `guardPath`・`packages/dashboard/src/features/docs`・DocsQuestionPanel の hostMode 送信抑止は実在。存在しないモジュールを「既存」と偽る主張は見当たらず |
| manual: NFR3.1 / NFR4.1 ID 衝突 | ACCEPTED RISK (prior stage) | 各 ID は設計上ひとつの機構族（globalState／単一ジョブ）に寄せられており、継承衝突単体では Critical にしない |
| manual: traceability.json vs NFR requirements IDs | PASS | upstream の NFR1.1–1.3, 2.1–2.3, 3.1–3.2, 4.1, 5.1 を漏れなく OK で被覆 |

### Summary

永続化の所有者（api-core 対 ExtensionContext／vscode-extension）が未解決のままでは実装境界が決まらないため NOT-READY。既存 docs-qa の hostMode／単一ジョブ／カバレッジ 95% ブロックへの参照は概ね正しいが、NFR2.1 のパスキー固定もゲート前に要る。
