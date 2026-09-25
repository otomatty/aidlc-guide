## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-09-24T12:20:00Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | packages/dashboard/src/features/docs/hooks/docs-conversation-bridge.ts > useDocsConversationBridge; packages/vscode-extension/src/docs-conversation.ts; packages/vscode-extension/src/dashboard-panel.ts > wireWebview | FR3 / BR3.1 / BR3.3 / NFR3.1 require conversation turns and draft to survive close/reopen via `ExtensionContext.globalState`. The claimed surface adds load/save helpers and a webview bridge that posts `docs-conversation`, but the host `wireWebview` message loop never imports or calls those helpers, never posts a restore payload on `ready`, and never persists inbound state. The bridge also refuses to save until `restoredRef` is set by a host message that never arrives, so the persistence path is dead end-to-end. | Wire host restore on webview ready (load → postMessage) and save on inbound `docs-conversation` state; claim that host file in `source-manifest.json`; add a unit-scoped test that the bridge round-trips through the host handler. | New |
| R-02 | Critical | packages/dashboard/src/features/docs/hooks/qa-wire.ts > receive | When appending a new job, `receive` keeps only `previous.slice(-19)`. BR3.2, FR3.1, entities.md, and reliability NFR3.1 forbid discarding older display turns (“件数の上限は置かない” / “溢れたら捨てる規則は無い”). Ask history may be limited to 8; the on-screen and persisted list must not. | Stop truncating the in-memory turn list for display/persistence; keep the 8-turn limit only in `docsQaAskHistory` / server validation. Cover with a test that >19 completed turns remain visible. | New |
| R-03 | Major | packages/api-core/src/docs-qa/validation.ts > parseQuestion history branch | History validation rejects turns whose `answer.length > 16000`. BR2.2 / FR4.1 require uncapped answers in the history that is passed (no character cut on answers). Rejecting long answers is an answer length gate and can block follow-up asks after a long reply. | Remove or redesign the answer length check so completed answers are accepted in full for history; keep the 2000-character limit on `question` only. Add a contract test with an answer longer than 16000 that still returns ok. | New |
| R-04 | Major | aidlc/spaces/default/intents/260923-docs-ask-chat/construction/docs-ask-chat/code-generation/code-generation-plan.md > Step 6; traceability.json > NFR4.1, AC3.1.3; source-manifest.json | Plan Step 6 says change `packages/api-core/src/handlers/docs-qa.ts`, but the delivered ask-history/2000-char work is in `validation.ts` and that handler is not in `source-manifest.json` writes. `NFR4.1` is marked OK against the thin handler (busy→409 mapping only), while single-flight behavior lives in the docs-qa service exercised by the contract tests. `AC3.1.3` (persist story) is targeted at `docs-qa-history.ts`, which implements the 8-turn ask window rather than restore/display persistence. | Align plan, manifest, and `traceability.json` OK targets with the files that actually implement each rule (service/validation for NFR4.1/BR2.x; `docs-conversation` + host wire for AC3.1.x); do not claim coverage on paths that do not carry the behavior. | New |
| R-05 | Minor | packages/vscode-extension/src/docs-conversation.test.ts; packages/vscode-extension/tests/docs-conversation.test.ts | The same six persistence cases appear in both `src/` and `tests/` copies. Duplication risks drift and double-runs without adding architectural coverage. | Keep a single unit-scoped test file and drop the duplicate from the manifest and tree. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Shell / stage sensors (linter, type-check, traceability) | Not run — preToolUse hook blocked shell execution in this review session | Structural sensor output unavailable; verdict rests on cross-checks of claimed source, upstream rules, and the host integration spot-check |
| Cross-ref: source-manifest ↔ traceability OK targets | Partial mismatch | `NFR4.1` targets `handlers/docs-qa.ts`, which is not listed under `writes`; plan Step 6 also named that path while delivery centered on `validation.ts` |
| Spot-check: host webview wiring for named persistence integration | FAIL | `dashboard-panel.ts` `wireWebview` has no `docs-conversation` / `loadDocsConversation` / `saveDocsConversation` path |

### Summary

End-to-end conversation persistence is not connected on the host, and the UI still drops older turns after 19, so FR3 / BR3.x / NFR3.1 cannot hold as designed. Fix the host bridge and remove the display cap before treating this unit as implementable and shippable.
