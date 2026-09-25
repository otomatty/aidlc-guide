# 横断の対応

判定は不合格。受入条件はすべて覆われている。要件本文の親 ID は、単位の traceability に同じ ID がない。

ステージ直下の `construction/code-generation/traceability.json` はない。読んだのは `construction/docs-ask-chat/code-generation/traceability.json` だけである。OK の行の対象ファイルは、すべてディスク上にある。

## 受入条件

| ID | 状態 | 所有 | 対象 |
| --- | --- | --- | --- |
| AC1.1.1 | OK | docs-ask-chat | packages/dashboard/src/features/docs/docs-shell-chat.tsx |
| AC1.1.2 | OK | docs-ask-chat | packages/dashboard/src/features/docs/DocsChat.tsx |
| AC1.1.3 | OK | docs-ask-chat | packages/api-core/src/docs-qa/validation.ts |
| AC1.1.4 | OK | docs-ask-chat | packages/api-core/tests/docs-qa-chat-contract.test.ts |
| AC2.1.1 | OK | docs-ask-chat | packages/dashboard/src/features/docs/hooks/useDocsQa.ts |
| AC2.1.2 | OK | docs-ask-chat | packages/dashboard/src/features/docs/hooks/docs-qa-history.ts |
| AC2.1.3 | OK | docs-ask-chat | packages/api-core/src/docs-qa/validation.ts |
| AC2.1.4 | OK | docs-ask-chat | packages/dashboard/src/features/docs/DocsChat.tsx |
| AC2.1.5 | OK | docs-ask-chat | packages/dashboard/src/features/docs/hooks/useDocsQa.ts |
| AC2.1.6 | OK | docs-ask-chat | packages/dashboard/src/features/docs/hooks/useDocsQa.ts |
| AC2.1.7 | OK | docs-ask-chat | packages/api-core/tests/docs-qa-chat-contract.test.ts |
| AC2.1.8 | OK | docs-ask-chat | packages/api-core/tests/docs-qa-chat-contract.test.ts |
| AC3.1.1 | OK | docs-ask-chat | packages/vscode-extension/src/docs-conversation.ts |
| AC3.1.2 | OK | docs-ask-chat | packages/vscode-extension/src/docs-conversation.ts |
| AC3.1.3 | OK | docs-ask-chat | packages/dashboard/src/features/docs/hooks/docs-qa-history.ts |
| AC3.1.4 | OK | docs-ask-chat | packages/vscode-extension/src/docs-conversation.ts |
| AC4.1.1 | OK | docs-ask-chat | packages/dashboard/src/features/docs/docs-question-panel-impl.tsx |
| AC4.1.2 | OK | docs-ask-chat | packages/dashboard/src/features/docs/DocsChat.tsx |
| AC4.1.3 | OK | docs-ask-chat | packages/vscode-extension/src/docs-conversation.ts |

## 覆われていない ID

要件本文の次の ID は、traceability の coverage に同じ文字列がない。

- FR1
- FR1.1
- FR1.2
- FR2
- FR2.1
- FR2.2
- FR3
- FR3.1
- FR3.2
- FR4
- FR4.1
- FR4.2
- FR5
- FR5.1
- FR5.2
- FR6
- FR6.1
- NFR1
- NFR2
- NFR3
- NFR4
- NFR5

細分した NFR1.1 から NFR5.1 は coverage にある。親の NFR1 から NFR5 はない。
