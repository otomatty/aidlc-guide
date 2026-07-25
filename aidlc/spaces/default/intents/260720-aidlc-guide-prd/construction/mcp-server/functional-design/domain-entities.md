# Domain Entities — Unit: mcp-server

> functional-design (3.1) / Unit: mcp-server / 2026-07-24
> 入力: component-methods.md（MCP tools 表）+ business-logic-model.md + shared-types

## 型定義（server 固有）

```ts
/** MCP ツール入力スキーマ（SDK の zod 相当で宣言） */
interface StatusInput {}                    // aidlc_status
interface ExplainStageInput { slug: string }
interface NextStepsInput {}
interface ReadArtifactInput { path: string }
interface GlossaryInput { term: string }

/** ツール応答の共通形（テキスト + 構造化データ併記 — BR-MS-6） */
interface ToolReply {
  text: string;                 // 日本語の人間可読テキスト（AI もこれを読む）
  data?: unknown;               // 構造化 JSON（WorkflowModel/StageDoc など）
  degraded?: { kind: "unsupported" | "error"; detail: string };  // 縮退の明示
}
```

## ライフサイクル

- サーバは stdio 常駐（Claude Code セッションと同寿命）。状態は {reader, bridge} のインスタンス参照のみ（キャッシュしない — 都度読取で最新を返す）。
- reader は呼出毎に recordDir を再解決（reader-core L7 の設計）ため、セッション中にインテントが切り替わっても追従する。

## テスト境界

- 5ツールのハンドラ単体（reader/bridge をスタブ）: 正常 / unsupported / error / warnings 各分岐が **通常応答**になること（isError にならないこと — BR-MS-3）
- read_artifact: 3ベクタ拒否（サーバ側 guardPath）
- 入力スキーマ違反のみ isError
- 統合: 実 tb-lxp に対する 5ツール応答のスモーク（build-and-test）
