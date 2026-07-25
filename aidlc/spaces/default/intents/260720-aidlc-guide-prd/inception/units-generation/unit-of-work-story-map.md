# Unit × Story Map — AIDLC Guide

> ステージ: units-generation (Inception 2.7) / 作成日: 2026-07-23
> 入力: unit-of-work.md + stories.md（22 US）+ requirements.md + application-design（components.md ほか）
> 全 22 ストーリーを 9 Unit に割当。横断ストーリーは主担当 + 関与 Unit を明示。

## Unit → Story 割当

| Unit | 主担当ストーリー | Unit 内実装順（依存に基づく素直な順。Bolt 順は 2.8） |
|------|----------------|---------------------------------------------|
| reader-core | US-09a, US-15 | US-09a（parse→tree→audit→intents→watch）→ US-15（5モード fail-soft + 空状態） |
| docs-bridge | US-23 | US-23（対応表→設定→リンク） |
| btw | US-06, US-07, US-08 | US-06（基本起動）→ US-07（fork）→ US-08（-p） |
| mcp-server | US-09b, US-04 | US-09b（status/next/read → 3ベクタ拒否 → explain/glossary）→ US-04（glossary 用語） |
| dashboard-server | （基盤・下記横断の受け皿） | API 骨格（/api/workflow 第1段）→ /api/matrix + WS → AnswerWriter |
| dashboard-ui | US-01, US-02, US-03, US-05, US-16, US-18 | US-01（NowStrip）→ US-02（NextStepCallout）→ US-16（rail+SKIP）→ US-05（matrix）→ US-03（StageCard）→ US-18（三重表現は各実装と同時+横断検査） |
| artifact-viewer | US-13, US-14 | Milkdown 実データ検証（M3冒頭）→ US-13（WYSIWYG+Mermaid）→ US-14（Answer 編集） |
| mob-mode | US-10, US-11, US-19 | US-19（bind/警告）→ US-10（broadcast/ライブ）→ US-11（read-only 担保） |
| ops-guides | US-12, US-22 | US-12（Live Share + トンネル、ADR-04 節含む）→ US-22（非同期共有） |

## 横断ストーリー（複数 Unit にまたがる）

| ストーリー | 主担当 | 関与 Unit | 備考 |
|-----------|--------|----------|------|
| US-15（fail-soft） | reader-core | dashboard-ui（UnparseableBadge/EmptyState 表示）, mcp-server（unsupported メッセージ） | データ層の縮退が主、表示は各サーフェスの5状態実装 |
| US-18（色覚非依存） | dashboard-ui | artifact-viewer, mob-mode（参加者ビュー） | StatusChip 共通コンポーネントで一元化 |
| US-02（次ステップ） | dashboard-ui | reader-core（getNextStep）, dashboard-server（API 中継） | NextStepCallout のデータ源は reader-core |
| US-20（性能・クロスOS） | 全 Unit | — | 受入計測は performance-validation（4.6）。各 Unit は設計上の対応（段階的初回描画・debounce 等）を実装 |
| US-14（Answer 記入） | artifact-viewer | dashboard-server（AnswerWriter/403） | UI と書込境界の分担 |

## カバレッジ検証

- **全 22 ストーリー割当済み**: US-01〜US-08 ✓ / US-09a・US-09b ✓ / US-10〜US-16 ✓ / US-18〜US-20 ✓ / US-22・US-23 ✓（欠番: US-17・US-21 は存在しない — stories.md の採番どおり）。
- **全 9 Unit にストーリーあり**: dashboard-server のみ「主担当ストーリーなし」だが、US-02/14/15/20 の関与 Unit かつ全 UI ストーリーの供給基盤（ADR-03）。基盤 Unit として妥当。
- ストーリー AC は各 Unit の完了条件に引き継がれる（Construction の functional-design 以降で詳細化）。
