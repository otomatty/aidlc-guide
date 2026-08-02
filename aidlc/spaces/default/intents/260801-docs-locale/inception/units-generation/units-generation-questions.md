# Units Generation — 質問ファイル

> ステージ: units-generation (Inception) / 深度: Standard  
> Intent: `260801-docs-locale`（docs-i18n **Bolt 2**）  
> 上流: [components.md](../application-design/components.md) / [component-methods.md](../application-design/component-methods.md) / [services.md](../application-design/services.md) / [component-dependency.md](../application-design/component-dependency.md) / [decisions.md](../application-design/decisions.md) / [requirements.md](../requirements-analysis/requirements.md) / [stories.md](../user-stories/stories.md)  
> 前提: Intent / state が **Units: docs-shell + official-docs** を既に名指し。本ステージは **依存トポロジのみ**（実装順・クリティカルパスは 2.8）。  
> 各質問の `[Answer]:` に記入してください。  
> **Mode:** guided（推奨セット一括採用）

---

## Q1. Unit 境界戦略

Bolt 2 の unit 分割はどれですか？

- A. Intent どおり **2 units**: `official-docs`（library: resolve/missing_ja/anchor/coverage）と `docs-shell`（ui: dashboard Docs Shell + extension 受入面）。api-core / shared-types の薄いパススルーは各 unit の契約差分として吸収し、独立 unit にしない
- B. パッケージごとに 4+ units（official-docs / api-core / dashboard / vscode-extension）
- C. 単一 unit `docs-locale` に全部入れる
- X. その他（具体的に記入）

[Answer]: A

## Q2. 粒度

- A. 粗め（上記 2 units）。横断の wire 契約は shared-types 既存を両 unit が参照
- B. 細かく（coverage 床を第 3 unit `docs-coverage` として分離）
- X. その他（具体的に記入）

[Answer]: A

## Q3. 依存トポロジ（実装順ではない）

どの依存辺が正しいですか？（トポロジのみ）

- A. `docs-shell` **depends_on** `official-docs`（UI は wire 契約＋resolve 意味に依存）。`official-docs` は `depends_on: []`
- B. 両 unit を独立（`depends_on: []` 同士）— 並行可能とみなす
- C. `official-docs` depends_on `docs-shell`
- X. その他（具体的に記入）

[Answer]: A

## Q4. Unit kind

各 unit の kind はどれですか？

- A. `official-docs` = **library**、`docs-shell` = **ui**（推奨）
- B. 両方 **service**
- C. `official-docs` = **service**、`docs-shell` = **ui**
- X. その他（具体的に記入）

[Answer]: A

## Q5. デプロイモデル

- A. 既存どおり: library は workspace パッケージ、ui は拡張 Webview に埋め込まれる。独立デプロイ単位を新設しない
- B. official-docs を別配布物にする
- X. その他（具体的に記入）

[Answer]: A

---

## Consolidated Summary Confirmation

推奨セットを一括採用した結果の要約です。

1. **Q1 = A** — 2 units: `official-docs` + `docs-shell`（api-core/shared-types は独立 unit にしない）
2. **Q2 = A** — 粗い粒度。wire は既存 shared-types
3. **Q3 = A** — `docs-shell` → depends_on → `official-docs`（トポロジのみ。実装順は 2.8）
4. **Q4 = A** — kinds: library + ui
5. **Q5 = A** — 既存配布モデル。新デプロイ単位なし

**Proposed plan (kinds):**
| Unit | Kind | depends_on |
|------|------|------------|
| official-docs | library | [] |
| docs-shell | ui | [official-docs] |

Does this all look correct before I generate the units-generation artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct

## Plan Approval

- Approve Plan
- Revise Plan

[Answer]: Approve Plan
