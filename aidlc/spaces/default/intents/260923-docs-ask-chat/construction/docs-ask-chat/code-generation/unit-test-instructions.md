# この塊のテスト

ランナーは Vitest。最初の Red の前に、既存の設定で次のコマンドが起動できることを確認する。

```bash
bun x vitest run packages/api-core/tests/docs-qa-routes.test.ts
```

この塊で足すファイルと、それぞれの実行コマンド:

```bash
bun x vitest run packages/vscode-extension/src/docs-conversation.test.ts
bun x vitest run packages/api-core/tests/docs-qa-chat-contract.test.ts
bun x vitest run packages/dashboard/src/features/docs/DocsChat.test.tsx
```

各ファイルは 6 件。境界は、保存の往復、ask の契約、画面の操作である。

| ファイル | 見るもの |
| --- | --- |
| `docs-conversation.test.ts` | 閉じたあともターンと書きかけが残る。ワークスペースのファイルは増えない。8 件を超えても一覧は切らない |
| `docs-qa-chat-contract.test.ts` | 渡す履歴は直近 8 件。2000 字を超えると送れない。進行中は 1 件。ホストモードは ask / job / cancel / evidence を拒否する |
| `DocsChat.test.tsx` | 入口からチャットへ移る。応答中は送信できない。引用から戻ると会話と書きかけが残る。失敗は入力のそばの短いメッセージ |

カバレッジは `vitest.config.ts` の `coverage.thresholds` に足す。`packages/api-core/src/handlers/docs-qa.ts` は `branches: 70`。ワークスペースは `lines: 80`。既存の 95% ブロックは残す。品質ゲート全体は `bun run check` のままである。

`globalState` はテスト内の偽の `ExtensionContext` で置き換える。ローカル CLI は契約テストでは呼ばない。
