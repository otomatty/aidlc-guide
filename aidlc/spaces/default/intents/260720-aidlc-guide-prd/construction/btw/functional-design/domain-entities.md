# Domain Entities — Unit: btw

> functional-design (3.1) / Unit: btw / 2026-07-23
> 入力: component-methods.md（btw CLI 表）+ unit-of-work.md U3 + requirements.md FR-3

## エンティティ（btw は小さな CLI — 4型で足りる）

```ts
/** パース済み CLI オプション（相互排他は parse 時に検証 — BR 参照） */
type BtwCommand =
  | { mode: "side" }                       // btw（既定）
  | { mode: "fork" }                       // btw --fork
  | { mode: "headless"; prompt: string }   // btw -p "<質問>"
  | { mode: "help" };                      // btw --help

/** fork 用に解決したセッション参照 */
interface SessionRef {
  sessionId: string;   // JSONL ファイル名由来
  jsonlPath: string;   // 解決元（診断表示用）
  mtime: Date;         // 最新判定の根拠
}

/** 起動計画（spawn 直前の中間表現。テストはここを検証しspawn自体はモック）
 *  launch="terminal": 新ターミナルで起動（OS 分岐あり — side/fork）
 *  launch="inline"  : 現在ターミナルで同期実行（OS 分岐なし — headless）
 *  どちらも plan.ts が生成し、--permission-mode plan は生成時に必ず連結される */
interface SpawnPlan {
  launch: "terminal" | "inline";
  platform?: "darwin" | "win32";  // launch="terminal" のときのみ
  command: string;     // 例: "open" / "cmd" / "claude"
  args: string[];      // 引数配列（文字列連結禁止 — BR バリデーション）
}

/** 正規化済みエラー（CLI 境界の唯一の失敗表現 — reliability-design R-BTW-1/5） */
interface BtwError {
  code: number;        // exit code（非ゼロ）
  message: string;     // stderr 1行
  hint?: string;       // 劣化案内（例: /branch 代替 + 計算パス）
}
```

## ライフサイクル / 関係

- `BtwCommand` は parse で生成され、1実行に1つ。状態遷移なし（ワンショット CLI）。
- `SessionRef` は `mode: "fork"` のときのみ解決される（他モードでは生成しない）。
- `SpawnPlan` は side/fork（launch="terminal"）・headless（launch="inline"）の全実行モードで plan.ts が生成 → 即 spawn。**plan フラグ連結の経路が1つに揃う**（S-BTW-1 の唯一の enforcement point）。
- `BtwError` は失敗時のみ生成され、cli.ts の単一 catch で exit に変換される。
- 永続化なし（DB 禁止 C-T1 / 書込禁止 BR-5 — ファイルもストアも持たない）。

## テスト対象境界

- parse: 引数 → BtwCommand（不正・組合せ・空文字列）
- **slug: cwd 絶対パス → プロジェクトスラッグ**（`C:\work\aidlc-guide`→`C--work-aidlc-guide` / `/Users/dev/aidlc-guide`→`-Users-dev-aidlc-guide` の両OSケースを純関数テスト — business-logic-model.md の変換規則）
- resolve: (slug 済みディレクトリの fixture) → SessionRef（最新選択・ディレクトリ不在/0件時 error + 計算パス保持）
- plan: (BtwCommand, platform) → SpawnPlan（OS 別のコマンド/引数、両OSぶん）
- spawn 実行はスモークのみ（US-06 AC の OS 別スモーク）
