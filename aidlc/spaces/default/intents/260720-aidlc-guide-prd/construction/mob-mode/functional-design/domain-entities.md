# Domain Entities — Unit: mob-mode

> functional-design (3.1) / Unit: mob-mode / 2026-07-25
> 入力: business-logic-model.md（M1〜M4）+ dashboard-server の ServeOptions/ServerMode + requirements.md

## 型（dashboard-server の型を拡張・再定義しない）

```ts
// dashboard-server が定義済み（本 Unit はこれらの host=true 経路を実装する）
//   interface ServeOptions { port: number; host: boolean }
//   interface ServerMode  { hostMode: boolean }   // GET /api/workflow が返す

/** 起動時に表示する公開情報（US-19 の検証対象） */
interface ExposureNotice {
  warning: string;          // U5 が持つ定数警告文字列（公開対象を名指し — BR-MM-2）
  addresses: string[];      // 本 Unit が列挙する待受アドレス（http://<ipv4>:<port>）
}

/** LiveStatus の表示モデル（AppState.live から導出 — BLM M3） */
type LiveStatusView =
  | { kind: "connecting" }                              // 「接続中…」
  | { kind: "live"; lastChangeAt: string }              // 「ライブ更新中 · 最終更新 …」
  | { kind: "reconnecting" }                            // 「切断・再接続中…」
  | { kind: "degraded"; reason: string };               // 「更新が止まっています（…）」
```

## ライフサイクル

- `hostMode` はプロセス起動時に確定し、実行中に変化しない（トグル API を持たない — 公開状態の変化はプロセス再起動でのみ起きる = 監査しやすい）。
- 参加者クライアントは通常のブラウザセッション。サーバ側にセッション状態を持たない（WS 接続の `clients: Set<WebSocket>` のみ — dashboard-server domain-entities.md「ライフサイクル」）。

## テスト境界

- `ExposureNotice.warning` の文言に必須語（成果物 / 監査 / 秘密を含み得る 相当）が含まれること（US-19 AC の自動検証）
- `addresses` が実際の NIC 由来の IPv4 を列挙すること（loopback 起動時は空 or localhost のみ）
- hostMode=true で POST /api/answer が 403（HTTP レベル）
- hostMode=true の GET /api/workflow 応答に `serverMode.hostMode === true` が含まれること
- 既定起動（--host なし）で bind が 127.0.0.1 であること
- `LiveStatusView` の導出: `AppState.live` の4組合せ → 4 kind（BLM M3 の表と1:1）
- LiveStatus が `role="status"` + `aria-live="polite"` を持つこと（a11y checklist 4.1.3）
