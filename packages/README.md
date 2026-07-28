# packages/ — 構造規約（置き場マップ）

このワークスペースのコーディング規約のうち、「どこに書くか」を定める部分。
lint/format は Biome（`biome.json`）、テスト・カバレッジ床は
`vitest.config.ts`、チーム実践は `aidlc/spaces/default/memory/` が正とする。
ここに書くのは**単一定義の置き場**だけ — 同じ知識を2箇所に書きそうになったら、
この表の置き場へ移してから参照する。

## パッケージと依存方向

```text
shared-types ← core-utils ← reader-core ← api-core ← dashboard-server / vscode-extension / mcp-server
                    ↑            ↑            ↑
                docs-bridge ─────┘       dashboard (wire 越しにのみ接続; reader-core を import しない)
```

- **shared-types** — wire 契約: 型 + 依存ゼロの wire 定数・純粋プレゼンタ
  （`SUPPORTED_STATE_VERSION` / `CONSTRUCTION_DIRNAME` / `artifactPath` /
  `formatDuration` / `CURRENT_ATTEMPT_STATUSES` / `currentStageMatches` /
  `stageViewMatches` / `StandardReason`）。全サーフェスがバイト単位で一致すべき
  値はここ以外に書かない。
  状態ファイルと監査ログの照合結果は `StageView` 1型に集約する（issue #9）—
  サーフェスは `currentStageMatches` / `stageViewMatches` で鮮度を見るだけで、
  「どの区間が今の試行か」を再導出しない。
- **core-utils** — 読み取り境界プリミティブ（`guardPath` / `withResult` /
  `readBounded`）。**パス封じ込めの実装は `guardPath` ただ1つ** — インラインの
  `path.relative` チェックを新設しない。
- **reader-core** — 純データ層。React / MCP SDK / HTTP・WS を import しない
  （構造テストで強制）。State Version 知識は `parse/` のみ。
- **docs-bridge** — slug/用語/agent メタデータ → docs の単一オーナー
  （`bridge-map.json` / `agent-map.json` / `parsePersonaMarkdown`）。
- **api-core** — トランスポート非依存のハンドラ＋hub。HTTP ステータス写像・
  `UNKNOWN_ROUTE`・`HOST_EXPOSURE_WARNING`（LAN 警告文言の唯一の原本）はここ。

## 個別規約

- **エラー reason**: 新しい reason は `StandardReason`（shared-types）に追加する。
  各サーフェスの文言マップは `Record<StandardReason, string>` で型付けされて
  いるため、追加すると文言を書くまでコンパイルが落ちる（それが仕様）。
- **手動同期コピーの禁止**: 「Keep in sync」コメント付きの複製を作らない。
  生成元から import する（例: `dashboard/src/data/stage-numbers.ts` は
  `.claude/tools/data/stage-graph.json` から導出）か、shared-types へ昇格する。
- **Webview 由来のパス**: vscode-extension では必ず
  `file-ref-target.ts` の `normalizeWebviewPath` / `docTarget` / `fileRefTarget`
  を通す。webview は信頼できない呼び出し元であり、生の `path.resolve` に
  渡さない。
- **dashboard の fetch**: エンドポイント fetcher は `services/api.ts` の
  `getResult<T>` を使う1行定義。パネル内ローカルの取得は `useFetchView` +
  `deriveViewState` に載せ、手書きの loading/error state 機械を新設しない。
- **パネル UI**: サイドパネルのクローム（FocusScope / 閉じるボタン / フォーカス
  復元）は `components/PanelShell.tsx`。
- **命名**: コンポーネントは PascalCase.tsx、フックは use*.ts、それ以外の
  モジュールは kebab-case.ts。
- **export は消費されるものだけ**: ファイル内でしか使わないシンボルを
  export しない（公開面 = 監査面）。
