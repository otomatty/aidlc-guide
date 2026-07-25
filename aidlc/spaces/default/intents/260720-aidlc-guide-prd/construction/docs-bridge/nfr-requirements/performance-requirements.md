# Performance Requirements — Unit: docs-bridge

> nfr-requirements (3.2) / Unit: docs-bridge (kind: library, S) / 2026-07-24
> 入力: functional-design/business-logic-model.md（D1〜D4）+ requirements.md

## 要件

| ID | 要件 | 測定 |
|----|------|------|
| P-DB-1 | 対応表ロード（起動時1回）≤50ms（bridge-map.json は数百 KB 以下の静的 JSON） | Vitest ベンチ |
| P-DB-2 | resolveStage/resolveTerm はメモリ参照 + （docs 添付時のみ）該当ファイル1枚の読取 ≤100ms | Vitest ベンチ |
| P-DB-3 | first paint（NFR-2）のクリティカルパスに乗らない（Dashboard の解説表示は遅延取得 — カードを開いた時に呼ぶ） | 設計検査 |

## 非目標

キャッシュ層・インデックスは対象外（メモリ常駐の静的 map で十分）。

## Review

**Verdict:** READY

- R-DB-1（reliability-requirements.md:10）: 内蔵 map の破損検出をビルド時（静的 import + data-lint/TS 型検査）に明記し直し、実行時 {error}/{warnings} 経路を docs 読取（D2/D3）と config（D1）のみに限定。tech-stack-decisions.md:17 の「`import map from "./data/bridge-map.json"`、実行時 fetch しない」と整合。検証欄も「ReadResult 網羅テスト（docs/config 経路）+ ビルド時 data-lint」に更新済み — 旧指摘（runtime-{error} vs 静的 import の矛盾）は解消。
- R-DB-4（reliability-requirements.md:13）: 「ローカル品質ゲート（`bun run check` 相当 — team.md。CI 基盤は無し）」に修正。team.md の Deployment 節（本プロジェクトはローカル専用、CD/CI 環境なし）と一致。CI 文言はこの「CI 基盤は無し」という否定形でのみ残存し、CI ゲート運用を前提とした表現は残っていない。
- scalability-requirements.md: H2 が「適用なし（明示）」「再訪トリガー」の2件に増補済み（旧指摘の単一 H2 を解消）。再訪条件（map が現状の100倍、P-DB-1 の 50ms 超過）も具体的で YAGNI 判断の根拠が追える。
- 回帰チェック: reliability/scalability/tech-stack/performance の4ファイル間で新規の矛盾なし。P-DB-1 の「起動時1回のロード ≤50ms」は静的 import のモジュール評価コストであり、ビルド時破損検出の主張と矛盾しない。CI 言及は R-DB-4 の否定形1箇所のみで一貫。
