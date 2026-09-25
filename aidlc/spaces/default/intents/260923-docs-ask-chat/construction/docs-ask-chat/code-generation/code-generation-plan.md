# コード生成計画 — docs-ask-chat

先に失敗するテストを書き、それから実装する。データベースは新設しない。データモデル層の Red/Green/Refactor は対象外である。

会話の読み書きは `packages/vscode-extension` の `ExtensionContext.globalState` に置く。`api-core` は進行中の 1 件だけを持ち、`vscode` を import しない。画面は表示と送信だけを行う。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "\u5148\u306b\u5931\u6557\u3059\u308b\u30c6\u30b9\u30c8\u3092\u66f8\u304d\u3001\u305d\u308c\u304b\u3089\u5b9f\u88c5\u3059\u308b\u3002",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Ordering**: \u5148\u306b\u5931\u6557\u3059\u308b\u30c6\u30b9\u30c8\u3092\u66f8\u304d\u3001\u305d\u308c\u304b\u3089\u5b9f\u88c5\u3059\u308b\u3002\n- \u30c6\u30b9\u30c8\u30e9\u30f3\u30ca\u30fc\u306f **Vitest**\u3002\u30ed\u30fc\u30ab\u30eb\u54c1\u8cea\u30b2\u30fc\u30c8\u306f\u5358\u4e00\u306e `bun run check`\u3002\n- \u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u5168\u4f53\u306b classic \u306e **line coverage 80%** \u5e8a\u3092\u9069\u7528\u3059\u308b\u3002\u65e2\u5b58\u306e **branch coverage 95%** \u5e8a\uff08`reader-core` parse \u304a\u3088\u3073\u9078\u5b9a `official-docs` \u30d1\u30b9\uff09\u306f\u73fe\u884c\u5bfe\u8c61\u306e\u307e\u307e\u6b8b\u3059\u3002\n- docs-qa \u5411\u3051\u306b **branch coverage 70%** \u4ee5\u4e0a\u306e\u5e8a\u3092\u65b0\u8a2d\u3059\u308b\u3002\u3053\u308c\u306f\u65e2\u5b58 95% \u5e8a\u306e\u7f6e\u63db\u3067\u306f\u306a\u304f\u52a0\u7b97\u3067\u3042\u308b\u3002\n- \u62e1\u5f35\u30db\u30b9\u30c8\u7d4c\u7531\u306e bundled docs \u8aad\u8fbc\u306b\u3064\u3044\u3066\u3001locale \u30b3\u30f3\u30c6\u30f3\u30c4\u30eb\u30fc\u30c8 + `guardPath` \u306e\u5426\u5b9a\u30c6\u30b9\u30c8\u3092 `bun run check` \u5bfe\u8c61\u306b\u542b\u3081\u308b\u3002\n- \u30c1\u30e3\u30c3\u30c8\u753b\u9762\u5316\u306e UI \u30c6\u30b9\u30c8\u3068\u5951\u7d04\u30c6\u30b9\u30c8\u306f `bun run check` \u306e\u5fc5\u9808\u9805\u76ee\u3068\u3059\u308b\uff08\u6b20\u843d\u3057\u305f\u5909\u66f4\u306f\u901a\u3055\u306a\u3044\uff09\u3002\n- \u5148\u884c\u80af\u5b9a\u306e US-06\uff08StageCard/Bridge \u3067 excerpt \u304c\u8a18\u4e8b\u3068\u3057\u3066\u30de\u30a6\u30f3\u30c8\u3055\u308c\u306a\u3044\u3053\u3068\u3001\u304a\u3088\u3073 primary CTA \u304c `open-official-doc` \u3092\u53e9\u304f\u3053\u3068\uff09\u306e UI/\u5951\u7d04\u30c6\u30b9\u30c8\u3082 `bun run check` \u306b\u542b\u3081\u7d9a\u3051\u308b\u3002\n- \u753b\u9762\u5074\u3068\u30b5\u30fc\u30d0\u5074\u306e\u8cea\u554f\u5c65\u6b74\u4e0a\u9650\u306f\u672c\u5909\u66f4\u3067\u63c3\u3048\u308b\u3002\u5171\u6709\u3059\u308b\u5177\u4f53\u6570\u5024\u306f\u672a\u78ba\u5b9a\u306e\u305f\u3081\u3001\u5b9f\u88c5\u524d\u306b\u5225\u9014\u6c7a\u3081\u308b\u3002\n- VSIX \u30b5\u30a4\u30ba\u306e\u6570\u5024\u30b2\u30fc\u30c8\u306f\u5f53\u9762\u8a2d\u3051\u306a\u3044\u3002"
    },
    {
      "layer": "project",
      "text": "- read-only \u3068\u5ba3\u8a00\u3057\u305f\u30d5\u30a3\u30af\u30b9\u30c1\u30e3\uff08tb-lxp \u7b49\uff09\u306b\u5bfe\u3057\u3066\u66f8\u304d\u8fbc\u307f\u3092\u4f34\u3046\u8a08\u6e2c\u304c\u5fc5\u8981\u306b\u306a\u3063\u305f\u5834\u5408\u306f\u3001\u30d5\u30a3\u30af\u30b9\u30c1\u30e3\u3092\u8907\u88fd\u3057\u3066\u8907\u88fd\u5074\u3067\u5b9f\u65bd\u3059\u308b\u3002\u8a08\u6e2c\u5f8c\u306b\u30d5\u30a3\u30af\u30b9\u30c1\u30e3\u304c\u6c5a\u308c\u3066\u3044\u306a\u3044\u3053\u3068\u3092 `git status` \u3068 mtime \u306e\u4e21\u65b9\u3067\u78ba\u8a8d\u3057\u3001\u78ba\u8a8d\u7d50\u679c\u3092\u6210\u679c\u7269\u306b\u8a18\u9332\u3059\u308b\u3002\u30d5\u30a3\u30af\u30b9\u30c1\u30e3\u3092\u76f4\u63a5\u66f8\u304d\u63db\u3048\u308b\u3068\u3001\u30d4\u30f3\u7559\u3081\u306b\u3088\u308b\u6c7a\u5b9a\u6027\u3068\u3044\u3046\u524d\u63d0\u305d\u306e\u3082\u306e\u304c\u58ca\u308c\u308b\u3002 (learned 2026-07-25) \n- \u6027\u80fd\u8a08\u6e2c\u306f\u5e73\u5747\u5024\u3092\u51fa\u3055\u305a min / p50 / p95 / max \u3067\u8a18\u9332\u3059\u308b\u3002\u4f53\u611f\u3092\u6c7a\u3081\u308b\u306e\u306f\u6700\u60aa\u5024\u3067\u3042\u308a\u3001\u5e73\u5747\u306f\u6700\u60aa\u5024\u3092\u96a0\u3059\u3002\u3042\u308f\u305b\u3066 cold\uff08\u30d7\u30ed\u30bb\u30b9\u8d77\u52d5\u76f4\u5f8c\u30fb\u30ad\u30e3\u30c3\u30b7\u30e5\u7121\u3057\uff09\u3068 warm \u3092\u5fc5\u305a\u5206\u3051\u3066\u8a18\u9332\u3059\u308b \u2014 \u7247\u65b9\u3060\u3051\u306e\u6570\u5b57\u306f\u518d\u73fe\u3057\u306a\u3044\u3002 (learned 2026-07-25) \n- UI \u3092\u7d4c\u7531\u3059\u308b\u6027\u80fd\u8981\u4ef6\u306f API \u306e\u76f4\u53e9\u304d\u3067\u306f\u306a\u304f\u5b9f UI \u306e\u64cd\u4f5c\u7d4c\u8def\u3067\u8a08\u6e2c\u3059\u308b\u3002API \u3060\u3051\u3092\u6e2c\u308b\u3068\u3001\u8a2d\u8a08\u304c\u8981\u6c42\u3057\u305f\u6a5f\u69cb\uff08\u9045\u5ef6\u30c1\u30e3\u30f3\u30af\u3068\u53d6\u5f97\u306e\u4e26\u884c\u767a\u706b\u306a\u3069\uff09\u304c\u5b9f\u969b\u306b\u52b9\u3044\u3066\u3044\u308b\u304b\u3092\u542b\u3081\u305f\u691c\u8a3c\u306b\u306a\u3089\u305a\u3001\u6a5f\u69cb\u304c\u58ca\u308c\u3066\u3044\u3066\u3082\u6570\u5024\u3060\u3051\u304c\u826f\u304f\u898b\u3048\u308b\u3002 (learned 2026-07-25)"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:203bc2481d0c9eab9997f0f5eedb4cbbddb02c96d76d3d202d56aa28a1582a30",
  "contract_sha256": "sha256:dd0dc9f15efd835d1261d9b4e50bee2a18c4bc50af0b5dddb0a9b866af66c8a0"
}
```

## 手順

- [x] Step 1. 既存の Vitest が、この塊のテストファイルパスで起動できることを確認する。US1.1
- [x] Step 2. Red: `packages/vscode-extension/src/docs-conversation.test.ts` に、保存と復元の失敗するテストを 6 件書く。US3.1
- [x] Step 3. Green: `packages/vscode-extension` に `globalState` の読み書きを足し、そのテストを通す。US3.1
- [x] Step 4. Refactor: 保存の形を整え、テストは緑のままにする。US3.1
- [x] Step 5. Red: 履歴 8 件、2000 字、同時 1 件の失敗するテストを `packages/api-core/tests/docs-qa-chat-contract.test.ts` に 6 件書く。US2.1
- [x] Step 6. Green: `packages/api-core/src/handlers/docs-qa.ts` を、そのテストが通るところまで変える。画面側の履歴も 8 件に揃える。US2.1
- [x] Step 7. Refactor: 成否は `DocsQaResult` のまま、テストは緑のままにする。US2.1
- [x] Step 8. Red: ホストモード拒否と、入口からチャットへ移る契約の失敗するテストを同じ契約ファイルに足す。US1.1 US2.1
- [x] Step 9. Green: 既存の ask / job / cancel / evidence の拒否を、そのテストが通るところまで確認し、足りなければ足す。US1.1
- [x] Step 10. Refactor: 経路を増やさず、テストは緑のままにする。US1.1
- [x] Step 11. Red: `packages/dashboard/src/features/docs/DocsChat.test.tsx` に、入口、送信停止、引用から戻る、の失敗するテストを 6 件書く。US1.1 US4.1
- [x] Step 12. Green: `packages/dashboard/src/features/docs` にチャット画面を足し、そのテストを通す。ホームに回答カードは積まない。US1.1 US4.1
- [x] Step 13. Refactor: 広いときは中央の列、狭いときは縦積み。テストは緑のまま。US1.1
- [x] Step 14. `vitest.config.ts` の `coverage.thresholds` に `packages/api-core/src/handlers/docs-qa.ts` の `branches: 70` と、ワークスペースの `lines: 80` を足す。既存 95% ブロックは残す。US2.1
- [x] Step 15. `code-summary.md` と `traceability.json` を書く。US1.1 US2.1 US3.1 US4.1

配置の成果物（Dockerfile、IaC）は作らない。
