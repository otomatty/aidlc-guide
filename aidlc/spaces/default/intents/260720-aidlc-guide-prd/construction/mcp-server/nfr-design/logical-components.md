# Logical Components — Unit: mcp-server

> nfr-design (3.3) / Unit: mcp-server / 2026-07-24
> 入力: functional-design 3文書（M1〜M5）+ 本ステージ設計文書

## モジュール構成（packages/mcp-server/src/）

| モジュール | 責務 | 依存 |
|-----------|------|------|
| `index.ts`（bin） | main(): workspaceRoot 解決 → reader/bridge 生成 → SDK Server + StdioServerTransport 起動 → ツール登録。**プロセスレベルの unhandledRejection/uncaughtException リスナ登録もここ**（R-MS-1 の第2層 — ログのみで exit しない） | 全下位 |
| `tools/status.ts` | M1（reader.getWorkflow） | reader, render |
| `tools/explain-stage.ts` | M2（bridge.resolveStage） | bridge, render |
| `tools/next-steps.ts` | M3（reader.getNextStep） | reader, render |
| `tools/read-artifact.ts` | M4（guardPath → reader.readArtifact） | reader(guardPath), render |
| `tools/glossary.ts` | M5（bridge.resolveTerm） | bridge, render |
| `render.ts` | renderResult(): ReadResult→ToolReply 写像 + パス相対化（S-MS-4） | — |
| `safe.ts` | safeHandler(): 例外→通常応答（R-MS-1） | — |

## データフロー

```
Claude Code ──stdio/JSON-RPC──▶ SDK Server
   └ tool call → safeHandler → tools/<name> → reader or bridge → renderResult → ToolReply
```

状態なし（reader/bridge の参照のみ）。テスト: 各ツールを reader/bridge スタブで単体（正常/unsupported/error/warnings が通常応答になること）+ tb-lxp 統合スモーク（build-and-test）。

## Review

**Verdict:** READY

### 要件カバレッジ（全 P-/S-/SC-/R-MS を突合）

- P-MS-1〜4 は全4件が `performance-design.md:10-13` の表にマップ済み（M1/M3 → reader 経路、M2/M5 → bridge 経路、起動 → 遅延初期化）。`nfr-requirements/performance-requirements.md` は既に自己レビュー済み（同ファイル21-29行目、Verdict READY）で加算が ceiling と一致することを確認済み — 本ステージはその設計側の実装先（reader/bridge どちらを叩くか）が要件表と矛盾なく一致することを確認した。
- S-MS-1〜5 は全5件が `security-design.md:10-14` にマップ済み。S-MS-2（`security-requirements.md:11`「サーバ前段でも呼ぶ + reader 内部一次（同一実装の二重呼出）」）と `logical-components.md:14`（`tools/read-artifact.ts` 責務「M4（guardPath → reader.readArtifact）」、依存「reader(guardPath), render」）が一致し、`business-rules.md:11`（BR-MS-2）の「同一実装の二重呼出」とも整合。
- SC-MS-1/2 は `scalability-design.md:10-11` に2件ともマップ済み。
- R-MS-1〜5 は全5件が `reliability-design.md:10-14` にマップ済み。

### 契約整合性チェック

- **isError はスキーマ違反のみ**: `reliability-design.md:11`「isError を返す経路はスキーマ検証層のみ — SDK の zod が担う」は `business-logic-model.md:66`「MCP プロトコルエラー（isError）にするのは入力スキーマ違反のみ」と完全一致。矛盾なし。
- **guardPath 事前ゲート**: `security-design.md:11` と `logical-components.md:14`（`tools/read-artifact.ts` 責務列）はいずれも guardPath をハンドラ冒頭 / reader.readArtifact 呼出前に置く設計で、`business-logic-model.md:43-44` の実装記述（サーバ側で先に guardPath を呼んで事前拒否）と順序が一致。
- **no-cache**: `performance-design.md:17`「応答キャッシュ（非採用）」、`reliability-design.md:13`（R-MS-4「サーバはキャッシュを持たない」）、`domain-entities.md:26`（reader-core 契約側「状態は…参照のみ（キャッシュしない）」）の3か所が相互に矛盾なし。
- **stdio-only**: `security-design.md:12`（S-MS-3）と `logical-components.md:10`（index.ts 責務「StdioServerTransport 起動」）、`tech-stack-decisions.md:10` の3か所が一致。HTTP/SSE への言及はどこにもない。
- **R-MS-1 のプロセスレベルハンドラは「落とさない」と矛盾しない**: `reliability-design.md:10`「process レベルで unhandledRejection/uncaughtException を捕捉しログのみ（exit しない）」、および「障害モード」節（19行目）「想定外例外 → safeHandler が『内部エラー』応答（プロセス継続）」の両方が exit しないことを明記しており、`reliability-requirements.md:10`（R-MS-1「未捕捉例外での終了ゼロ」）と整合。

### モジュール分解の一貫性

- `logical-components.md:10-17` のモジュール表は M1-M5（`tools/status.ts`〜`tools/glossary.ts`）+ `render.ts` + `safe.ts` を全て含み、各ツールの依存が要件と対応（M1/M3 は `reader`、M2/M5 は `bridge` のみで `reader` を経由しない — `performance-design.md:11`「reader を経由しない」と一致）。循環依存なし（`index.ts` が唯一の上位ノード、`render.ts`/`safe.ts` は無依存）。

### 非ブロッキング所見

- `reliability-design.md:10` が記述する「process レベルの unhandledRejection/uncaughtException 捕捉」は、モジュール表（6-17行目）のどのモジュールの責務にも明示的に割り当てられていない（`index.ts` の責務列は「main(): …→ ツール登録」までで、プロセスレベルのリスナー登録が触れられていない）。`index.ts` が唯一の起動コードだと推測はできるが、実装者が迷わないよう次イテレーションで明記を推奨。ブロッキングではない。
- `performance-design.md:13`「createReader/createBridge は遅延（FS を触らない）」という表現は、`logical-components.md:10`（`index.ts` が起動シーケンス内で reader/bridge を生成）や `business-logic-model.md:9-11`（起動シーケンスで `reader = createReader(...)` を明示的に呼ぶ）と並べるとやや紛らわしい。P-MS-4 の予算内訳（`performance-requirements.md:15`）が `createReader ≤50ms` を起動シーケンスの一部として計上していることから、「遅延」は生成タイミングではなく実ファイル読取りの遅延を指すと解釈できるが、字面だけでは誤読の余地がある。矛盾ではなく用語の精度の問題。

