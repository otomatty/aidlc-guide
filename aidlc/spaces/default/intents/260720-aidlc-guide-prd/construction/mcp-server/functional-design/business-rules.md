# Business Rules — Unit: mcp-server

> functional-design (3.1) / Unit: mcp-server / 2026-07-24
> 入力: requirements.md（FR-2, NFR-1）+ components.md C4 + business-logic-model.md + project.md Mandated

## ルール

| ID | ルール | 出所 |
|----|--------|------|
| BR-MS-1 | **書込 API を一切公開しない**（5ツールは全て読取。write 系 fs import ゼロ — Biome 構造禁止） | NFR-1 / C4 |
| BR-MS-2 | read_artifact は記録ディレクトリ配下のみ。reader-core の公開 `guardPath` を**サーバ前段でも呼ぶ**（同一実装の二重呼出 — 別実装の重複ではない。reader 内部の一次検査が最終防衛線） | FR-2.4 |
| BR-MS-3 | **データ失敗を MCP エラーにしない**: 通常応答で理由を返す（isError は入力スキーマ違反のみ）。AI が理由を読んで次を選べることが価値 | 設計判断（fail-soft の AI 面） |
| BR-MS-4 | **AI 要約をしない**: explain_stage/glossary は docs-bridge の verbatim 抜粋 + 静的エントリをそのまま返す（サーバ側で言い換え・要約しない） | PRD §8 / BR-DB-2 |
| BR-MS-5 | プロセスを落とさない（常駐の可用性 = Claude Code 側の全ツール可用性）。想定外例外も応答に変換 | services.md S1 |
| BR-MS-6 | 応答は日本語（本プロジェクトの利用者向け）+ 構造化 JSON を併記（AI が機械的に扱える） | 利用文脈 |

## ツール記述（description）の規約

各ツールの description には「いつ使うか」を1行で書く（AI の選択精度に直結）。例: `aidlc_status` = 「現在のワークフロー位置（フェーズ/ステージ/ゲート/進捗）を知りたいとき」。
