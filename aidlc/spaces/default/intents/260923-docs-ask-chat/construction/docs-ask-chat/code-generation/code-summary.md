# コード生成サマリ — docs-ask-chat

会話の保存、質問の契約、チャット画面を既存パッケージに足した。データベースと配置成果物は作っていない。

## 作ったもの

- `packages/vscode-extension/src/docs-conversation.ts` — ターンと書きかけを `ExtensionContext.globalState` に読み書きする。ワークスペースのファイルは増やさない。
- `packages/api-core/src/docs-qa/validation.ts` — 履歴は直近 8 件、本文は 2000 字まで。成否は `DocsQaResult` のまま。
- `packages/dashboard/src/features/docs/DocsChat.tsx` と `docs-shell-chat.tsx` — 入口からチャットへ移る。ホームに回答カードは積まない。広いときは中央の列、狭いときは縦積み。
- `packages/dashboard/src/features/docs/docs-question-panel-impl.tsx` — 引用は `参照 N: 題名` のボタン。記事からチャットへ戻れる。
- `vitest.config.ts` — `packages/api-core/src/handlers/docs-qa.ts` に `branches: 70`。ワークスペースに `lines: 80`。既存の 95% ブロックは残した。

## テスト

次のコマンドは 5 ファイル、70 件が成功した。

```bash
bun x vitest run packages/api-core/tests/docs-qa-chat-contract.test.ts packages/dashboard/src/features/docs/DocsChat.test.tsx packages/dashboard/src/features/docs/docs-shell-chat.test.ts packages/dashboard/src/features/docs/DocsPage.test.tsx packages/dashboard/src/features/docs/hooks/useDocsQa.test.tsx
```

保存の往復は `packages/vscode-extension/src/docs-conversation.test.ts`。契約は `packages/api-core/tests/docs-qa-chat-contract.test.ts`。画面は `DocsChat.test.tsx`。

## 計画との差

計画の Step 1 から Step 14 は完了した。引用ボタンが一時期リンクになり、既存の `useDocsQa.test.tsx` が 9 件失敗した。ボタン名を戻して同じ 70 件を通し直した。品質の下限は下げていない。

やり直し 1 では、未整形だった `docs-question-panel-impl.tsx`、`docs-shell-chat.tsx`、`useDocsQa.ts` を oxfmt で整形した。挙動は変えていない。
