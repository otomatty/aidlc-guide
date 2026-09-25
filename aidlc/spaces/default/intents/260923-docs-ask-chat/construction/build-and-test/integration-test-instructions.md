# 結合テスト

テスト戦略は Standard。このファイルは、保存・契約・画面の境界をまたぐ確認だけを書く。単体はコード生成側の手順が持つ。

## 枠組み

ランナーは Vitest。品質ゲート全体は `bun run check` で、その中の `test:coverage` がカバレッジ閾値も見る。

## 実行

この塊の境界は、次の 1 コマンドにまとまっている。同じコマンドを単位の数だけ繰り返さない。

```bash
bun x vitest run packages/api-core/tests/docs-qa-chat-contract.test.ts packages/dashboard/src/features/docs/DocsChat.test.tsx packages/dashboard/src/features/docs/docs-shell-chat.test.ts packages/dashboard/src/features/docs/DocsPage.test.tsx packages/dashboard/src/features/docs/hooks/useDocsQa.test.tsx
```

保存の往復は拡張ホスト側で、別に 1 回だけ実行する。

```bash
bun x vitest run packages/vscode-extension/src/docs-conversation.test.ts
```

## 見る境界

- 契約: 履歴は直近 8 件、本文は 2000 字まで、進行中は 1 件。ホストモードは ask / job / cancel / evidence を拒否する。
- 画面: 入口からチャットへ移る。応答中は送信できない。引用から戻ると会話と書きかけが残る。
- 保存: 閉じたあともターンと書きかけが残る。ワークスペースのファイルは増えない。

## カバレッジ

`bun run check` がワークスペース行 80%、docs-qa ハンドラの分岐 70%、既存 95% ブロックを同時に見る。閾値は下げない。

## データ

`globalState` はテスト内の偽の `ExtensionContext` で置き換える。ローカル CLI は契約テストでは呼ばない。クラウドへは出さない。
