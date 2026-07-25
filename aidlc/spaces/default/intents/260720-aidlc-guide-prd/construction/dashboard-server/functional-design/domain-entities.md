# Domain Entities — Unit: dashboard-server

> functional-design (3.1) / Unit: dashboard-server / 2026-07-24
> 入力: component-methods.md + business-logic-model.md + shared-types（reader-core/docs-bridge 定義）

## 型定義（server 固有 — shared-types に追加）

```ts
interface ServeOptions {
  port: number;          // 既定固定（例 4700）
  host: boolean;         // --host（LAN bind + read-only mode + 警告）
}

/** WS メッセージ（判別可能ユニオン — クライアントと共有） */
type WsMessage =
  | { type: "matrix-ready"; matrix: Matrix }
  | { type: "change"; scope: "state"; workflow: WorkflowModel; nextStep: NextStep }
  | { type: "change"; scope: `matrix:${string}`; cells: MatrixCell[] }
  | { type: "change"; scope: "audit"; events: AuditEvent[] }
  | { type: "live-status"; degraded: boolean; reason?: string };

interface AnswerRequest { file: string; line: number; value: string; }  // フィールド名は component-methods.md 契約どおり
// **line は 1 始まり**（実装時に確定 — code-generation D-3）。エディタの行番号表示と一致させるため。
// dashboard-ui / artifact-viewer の AnswerEditor はこの基数に従うこと。
interface ServerMode { hostMode: boolean; }   // GET /api/workflow が返す（クライアントの編集UI抑止用 — US-11 二重防御）
type AnswerError = "read-only-mode" | "not-a-questions-file" | "outside-record"
                 | "not-an-answer-line" | "write-verification-failed";
```

## ライフサイクル

- サーバ状態: {config, matrixCache: Matrix | {building:true}, clients: Set<WebSocket>}。matrixCache は起動第2段で埋まり、以降 buildMatrixForUnit の差分で更新。
- WS クライアント: 接続時に現在のスナップショット状態を送らない（クライアントは REST で初期取得 → WS は差分のみ。再接続時も同じ手順 — プロトコルを単純に保つ）。

## テスト境界

- AnswerWriter: 7ステップの各ゲート（403 系 4種 + byte-invariance golden + atomic rename）。**モード×ファイル×行の全組合せ**
- ReadResult→HTTP 写像: unsupported/error が 500 にならないこと
- bind: 既定 loopback / --host 時の警告文言存在（US-19 AC）
- WS: scope 別 broadcast + live-status（watch-warning 変換）
