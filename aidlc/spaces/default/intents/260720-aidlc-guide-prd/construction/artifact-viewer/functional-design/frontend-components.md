# Frontend Components — Unit: artifact-viewer

> functional-design (3.1) / Unit: artifact-viewer (kind: ui, M) / 2026-07-25
> 入力: business-logic-model.md（D1〜D3・データ契約）+ refined-mockups M-2b / interaction-spec / accessibility-checklist + components.md C6

## コンポーネント階層（DetailPanel 内に差し込まれる）

```
ArtifactViewer                      （dashboard-ui の DetailPanel が lazy import）
 ├ ViewerToolbar                    成果物切替（同 unit×stage 内）/ verdict バッジ / 閉じる
 ├ MarkdownSurface                  ← Milkdown(Crepe) を隠す実装境界（ADR-05）
 │   └ MermaidBlock                 Mermaid 描画（不正時はコードフォールバック）
 └ AnswerEditor                     *-questions.md の [Answer]: 行のみ（editable のとき）
     └ SaveBar                      保存ボタン + 保存結果メッセージ
```

## コンポーネント仕様

### ArtifactViewer（US-13 / FR-6.1）
- **Props**: `{ path: string, state: ViewState<ArtifactPayload>, onClose }`
- **責務**: D1 のフロー実行 + 5状態の描画切替。read-only 既定
- **a11y**: **フォーカス移動も Esc も親 DetailPanel が処理**（開時の h2 フォーカスは DetailPanel の契約 — dashboard-ui frontend-components。本 Unit は h2 を提供するのみで自前のフォーカス制御を持たない＝二重ハンドラを作らない）

### MarkdownSurface（データ契約の実装境界 — ADR-05）
- **Props**: `{ markdown: string, editable: EditableSpec | null, onEdit(line, value) }`
- **責務**: markdown 描画 + 編集可能行の受け渡し。**内部実装（Milkdown/BlockNote/plain）は Props から観測不能**
- **実行時フォールバック**: 内部ビューアが例外を投げた場合、本コンポーネント内の ErrorBoundary が捕捉して plain preview（`<pre>` 生 Markdown）に切り替える（BLM D3 の error(b)。Props 契約は不変 — 呼出側は失敗を意識しない）
- **a11y**: read-only 領域は `aria-readonly`。編集可能行のみ `contenteditable` + 明示ラベル
- **テスト**: この Props/Callback 契約に対して書く（実装差し替えでテストが壊れない）

### MermaidBlock（FR-6.3）
- **Props**: `{ code: string }`
- **責務**: Mermaid 描画。パース失敗時は `<pre><code>` にフォールバック + 「図として描画できません」注記（クラッシュしない）

### AnswerEditor（US-14 / FR-6.2）
- **Props**: `{ path: string, answerLines: number[], hostMode: boolean, onSaved() }`
- **挙動**: 対象行のみ編集可。保存は明示ボタン（誤爆防止 — interaction-spec）。`hostMode` が true のときは編集 UI を**描画しない**（サーバも 403 で二重防御）
- **エラー表示**: D2 の 403/500 メッセージをインラインで表示
- **a11y**: 各編集欄に `<label>`（対応する質問番号）。保存結果は `role="status"`

## 状態と読み込み

- 本 Unit は dashboard-ui から `React.lazy` で遅延ロード（初期バンドルに Milkdown を含めない — P-UI-1）。
- Mermaid ライブラリも `MermaidBlock` 内で動的 import（図がない成果物では読み込まない）。
