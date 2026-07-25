# Code Generation Plan — Unit: mcp-server

> code-generation (3.5) / Unit: mcp-server (kind: service, M) / 2026-07-25
> 入力: functional-design 3文書（M1〜M5 / BR-MS-1〜6 / ToolReply）+ nfr-requirements
> 5文書（P-MS / S-MS / SC-MS / R-MS / tech-stack）+ nfr-design 5文書
> （特に logical-components.md のモジュール表）+ team.md / project.md
> トレーサビリティ: US-09b（AI が現在地を答えられる = FR-2.1/2.3）/ US-03（ステージ
> 解説の MCP 面 = FR-2.2）/ US-04（用語解説 = FR-2.5）/ FR-2.4（成果物読取）
> 本ユニット完了で **M1 マイルストーン完了**（bolt-plan B3 の DoD = `.mcp.json` 登録手順）

## 方針

nfr-design/logical-components.md のモジュール表を**そのまま**ファイル構成にする
（index.ts + tools/5本 + render.ts + safe.ts）。追加モジュールは作らない。
サーバは状態を持たず（reader/bridge の参照のみ）、キャッシュしない（R-MS-4）。
ReadResult→応答の写像は `render.ts` の1関数に集約し、各ツールは「依存を1回呼んで
成功形を日本語に整形する」だけに留める。

## チェックリスト

### A. 基盤（logical-components.md のモジュール表どおり）

- [x] `package.json` — 依存は `@modelcontextprotocol/sdk` + zod + workspace 3本のみ
      （tech-stack-decisions.md）。bin `aidlc-mcp`
- [x] `src/render.ts` — `ToolReply` 型 / `renderResult()` / `renderDegraded()` /
      `reasonText()` / `relativize()` / `toContent()`。**ReadResult→応答の唯一の写像**
      （R-MS-2）。他モジュールへの依存ゼロ
- [x] `src/render.ts` — reason ごとの日本語1行 + 可能なら代替案内
      （reader-core の `StandardReason` 6件 + docs-bridge の3件 + `internal:` 正規化 +
      未知 reason のフォールバック）
- [x] `src/render.ts` — `relativize()` が workspaceRoot を応答から剥がす（S-MS-4）。
      セパレータ非依存（`C:\a\b` と `C:/a/b` を同一視）、Windows のみ大小無視
- [x] `src/safe.ts` — `safeHandler(workspaceRoot, fn)`。想定外例外を
      「内部エラー: …」の**通常応答**に正規化（R-MS-1 第1層）。throw もしないし
      isError にもしない

### B. 5ツール（M1〜M5）

- [x] `src/tools/status.ts` — M1。`reader.getWorkflow()` **のみ**（`getNextStep` は
      呼ばない = component-methods.md の契約。next step は M3 の担当）。
      phase / currentStage / gate / done / total + `unparseable` の明示
- [x] `src/tools/next-steps.ts` — M3。`reader.getNextStep()` の唯一の呼出元。
      `nextStage === null` → 「ワークフロー完了」
- [x] `src/tools/explain-stage.ts` — M2。`bridge.resolveStage(slug)`。5フィールド +
      deep-link + excerpt を**原文のまま**（BR-MS-4 — 要約・言い換えをしない）。
      未知 slug（`not-found`）は「該当なし」の通常応答
- [x] `src/tools/read-artifact.ts` — M4。`recordDir()` → **サーバ前段 `guardPath`**
      → `reader.readArtifact()`。前段は reader-core の公開 named export を呼ぶ
      （BR-MS-2 = 同一実装の二重呼出。第2の実装を作らない）
- [x] `src/tools/glossary.ts` — M5。`bridge.resolveTerm(term)`。未知は「未定義」
- [x] 5ツールの `description` に「いつ使うか」を明記（BR-MS-6 規約 — コードコメント
      ではなく description 文字列に書く）

### C. 起動（index.ts）

- [x] workspaceRoot を cwd から解決 → `createReader` / `createBridge`（生成時に
      FS を触らない = P-MS-4 / R-MS-3）→ 5ツール登録 → `StdioServerTransport`
- [x] トランスポートは stdio のみ。HTTP/SSE のコードを持たない（S-MS-3）
- [x] process レベルの `unhandledRejection` / `uncaughtException` リスナ登録。
      **ログのみで exit しない**（R-MS-1 第2層。常駐が切れると Claude Code 側の
      全ツールが失われる — BR-MS-5）
- [x] ログは stderr へ（stdout は JSON-RPC 専用チャネル）

### D. テスト（domain-entities.md「テスト境界」）

- [x] 5ツール × 分岐（reader/bridge スタブ）: `{ok}` / `{ok}`+warnings /
      `{unsupported}` / 各 `{error, reason}` が**すべて通常応答**になること
      （BR-MS-3 — isError にならないこと）
- [x] `render.ts`: reason→メッセージ表の全件、絶対パスの相対化（S-MS-4）、
      warnings の「注意:」付与、verbatim モードの非改変・非複製、`toContent` の
      JSON 併記（BR-MS-6）
- [x] `safe.ts`: throw するハンドラが「内部エラー」の通常応答になること、
      非 Error throw、例外メッセージ中の絶対パス剥がし
- [x] read_artifact: 3ベクタ（`../` traversal / 記録外の絶対パス /
      `/rec/foobar` prefix-confusion）が**サーバ前段で**拒否され、
      `reader.readArtifact` に到達しないこと（S-MS-2）
- [x] status: `getNextStep` が呼ばれないこと（M1 の委譲契約）
- [x] 実 stdio スモーク: 子 Bun プロセスを SDK の実 MCP クライアントで駆動し、
      5ツールの登録・description・実応答、および **isError は入力スキーマ違反のみ**
      であることを検証

### E. 品質ゲート（team.md）

- [x] Biome の read-only restricted-imports override を `packages/mcp-server/src/**`
      へ拡張（S-MS-1 / BR-MS-1 — write 系 fs import ゼロ）
- [x] `vitest.config.ts` の coverage exclude に `mcp-server/src/index.ts` を追加
      （プロセス境界。スモークで検証）
- [x] `bun run check`（biome + tsc --noEmit + vitest --coverage + bun audit）green
- [x] `README.md` に `.mcp.json` 登録手順（bolt-plan B3 の DoD / M1 完了条件）

## 承認

実装計画は本ファイルの内容で確定。実行結果は `code-summary.md` を参照。
