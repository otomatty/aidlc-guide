# Domain Entities — Unit: docs-bridge

> functional-design (3.1) / Unit: docs-bridge / 2026-07-24
> 入力: component-methods.md + business-logic-model.md + business-rules.md

## 型定義（shared-types に追加）

```ts
// ReadResult は shared-types の正準定義を使う（warnings?: string[] を含む —
// reader-core/functional-design/domain-entities.md 参照。本 Unit は再定義しない）

interface BridgeConfig {
  docsRepoPath: string | null;   // FR-5.2（null = docs 本文添付なしで動作）
  projectLinks: ProjectLink[];   // FR-5.3
}
interface ProjectLink { label: string; target: string; }  // target = 相対パス or URL（component-methods.md の Link[] の実現型）

interface StageDoc {
  slug: string;
  purpose: string;               // US-03 ①目的（1-2文）
  inputs: string[];              // ②入力
  outputs: string[];             // ②出力
  agent: string;                 // ③担当エージェント
  gateRequirement: string;       // ④ゲートで求められること
  deepLink: { docPath: string; docAnchor: string } | null;
  excerpt: string | null;        // docs 該当節そのまま（BR-DB-2。docs 不在は null + warnings）
  sourceVersion: string;         // BR-DB-4
}

interface TermDoc {
  term: string;
  definition: string;
  deepLink: { docPath: string; docAnchor: string } | null;
  excerpt: string | null;
  sourceVersion: string;
}
```

## ライフサイクル / テスト境界

- 対応表は起動時 1 回ロードしてメモリ保持（静的・小さい。watch しない — 変更はプロセス再起動で反映、S規模に十分）。
- テスト: resolveStage/resolveTerm の {既知, 未知, docs 有, docs 無, 節欠落} 分岐 + config の {省略, 不在, 不正, 検証 warning} 分岐 + **cross-consumer 整合**（同一 slug で2回呼んで同一値 — US-23 AC の単体版。実際の MCP/Dashboard 経由の整合は build-and-test の統合テストで検証）。
- **データ検証テスト（US-03 AC ⑤）**: bridge-map.json の全エントリの docPath/docAnchor が実 docs ツリーに解決することを検証する data-lint テストを本 Unit に置く（docs clone があるローカル品質ゲート（`bun run check` 相当 — team.md、CI 基盤なし）で実行。docs が無ければ skip — build-and-test で必須化）。
- reason 値: `"config-invalid" | "not-found" | "undefined-term"`（reader-core の標準 reason 空間と衝突しない接頭辞なし別名 — 消費者は Unit 別に分岐）。
