# Performance Requirements — Unit: mcp-server

> nfr-requirements (3.2) / Unit: mcp-server / 2026-07-24
> 入力: functional-design/business-logic-model.md（M1〜M5）+ requirements.md + reader-core P-RC 予算

## 適用範囲

NFR-2/3 は Dashboard の要件であり mcp-server には適用されない（requirements.md の AC が Dashboard 対象）。MCP は AI の対話ループ内で呼ばれるため、体感は「AI の思考時間に埋もれる」ことが目標。

| ID | 要件 | 測定 |
|----|------|------|
| P-MS-1 | `aidlc_status` / `aidlc_next_steps` は ≤300ms（reader の recordDir 再解決 ≤20ms [P-RC-7] + readState ≤100ms [P-RC-1] + 応答整形 ≤180ms） | Vitest ベンチ |
| P-MS-2 | `aidlc_explain_stage` / `aidlc_glossary` は ≤200ms（docs-bridge の解決 ≤100ms [P-DB-2] + 整形 ≤100ms。reader を経ないため recordDir 再解決なし） | ベンチ |
| P-MS-3 | `aidlc_read_artifact` は ≤500ms @ 一般的な成果物（〜100KB）: recordDir 再解決 ≤20ms [P-RC-7] + readArtifact ≤300ms [P-RC-6] + サーバ側 guardPath・整形 ≤180ms。10MB 上限ファイルでも ≤2s（P-RC-6 の 1.5s + 整形） | ベンチ |
| P-MS-4 | サーバ起動（Claude Code の spawn → ツール利用可能）≤500ms: bun 起動 ~20ms + createReader ≤50ms [P-RC-7] + createBridge（静的 import ≤50ms [P-DB-1]）+ MCP SDK 初期化・ツール登録 ≤380ms | 起動計測 |

## 非目標

スループット・並行呼出（MCP は逐次要求が基本）・キャッシュ（都度最新を返すことが価値）。

## Review

**Verdict:** READY

- reader-core 契約（performance-requirements.md:17-18）に P-RC-6（readArtifact ≤300ms @〜100KB、≤1.5s @10MB上限）と P-RC-7（createReader() 初期化 ≤50ms + メソッド呼出毎の recordDir 再解決 ≤20ms）が存在することを確認。イテレーション1で指摘した「存在しない予算行の引用」は解消。
- P-MS-1〜4 の加算を実引用値で検算し、いずれも申告 ceiling に一致することを確認: P-MS-1 = 20(P-RC-7 recordDir)+100(P-RC-1)+180(整形)=300ms=ceiling。P-MS-2 = 100(P-DB-2)+100(整形)=200ms=ceiling（reader を経ないため recordDir 再解決なし、との明記も業務ロジック上妥当）。P-MS-3 = 20(P-RC-7 recordDir)+300(P-RC-6)+180(整形)=500ms=ceiling、10MB経路は 1500(P-RC-6上限)+180=1680ms ≤2000ms cap（320msの余裕）。P-MS-4 = 20(bun)+50(P-RC-7 init)+50(P-DB-1)+380(SDK初期化)=500ms=ceiling。
- recordDir 再解決コストは reader を呼ぶ経路（P-MS-1, P-MS-3）にのみ計上され、bridge-only 経路（P-MS-2）には正しく含まれていない。イテレーション1で指摘した「R-MS-4 相当のper-call recordDir 再解決の未計上」はこの版で解消。
- 回帰チェック: reader-core（P-RC contract）・docs-bridge（P-DB contract）との間で新規の矛盾なし。非目標欄・適用範囲欄も従来通り整合。
- 非ブロッキング所見: P-MS-1・P-MS-2・P-MS-4、および P-MS-3 の100KB経路は、いずれも合算が ceiling にジャストフィットしており実装時の揺らぎに対する余裕がゼロ。予算超過ではないため NOT-READY の根拠にはしないが、build-and-test 段階での実測時にバッファ再検討を推奨する。
