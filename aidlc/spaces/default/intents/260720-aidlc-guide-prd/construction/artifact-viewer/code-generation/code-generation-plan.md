# Code Generation Plan — Unit: artifact-viewer

> code-generation (3.5) / Unit: artifact-viewer (kind: ui, M) / 2026-07-25
> 入力: functional-design（business-logic-model D1〜D3 + データ契約 / frontend-components）
> + nfr-design（logical-components のモジュール表 / performance-design P-AV-1〜5 /
> security-design S-AV-1〜5）+ nfr-requirements（tech-stack-decisions）
> 実装場所: `packages/dashboard/src/viewer/`（既存 dashboard パッケージ内の遅延ロード領域）

## 0. 前提作業: Milkdown/Crepe 候補検証（FR-6.1 AC / feasibility R-2）

**実装の最初の作業**として、実 tb-lxp 形式の成果物5件に対し5項目チェックリストを実行する。
1項目でも不合格なら `tech-stack-decisions.md` の交代順（Milkdown → BlockNote →
plain preview）に従って候補を交代し、**判定と証拠を code-summary.md に記録**する
（交代は設計上の想定内であり逸脱ではないが、記録は必須）。

判定結果と実測値は `code-summary.md` §「Milkdown 5項目チェック」に記載。

## 1. 先行する横断変更: `MatrixCell.count` → `files: string[]`

ビューアは「セル内の成果物ファイル名一覧」を必要とするが、現在ワイヤ上にその情報が無い
（`count` は件数のみ）。`reader-core/src/tree/matrix.ts` の `cellFor` は既にファイル名配列を
持っており、それを捨てて件数だけを返している。**新エンドポイントを足さず**、既存フィールドを
置換する。

| ファイル | 変更 |
|---------|------|
| `packages/shared-types/src/index.ts` | `count: number` → `files: string[]` |
| `packages/reader-core/src/tree/matrix.ts` | `cellFor` が `files` を返す（3分岐すべて） |
| `packages/dashboard/src/components/UnitStageMatrix.tsx` | 表示は `cell.files.length` |
| `packages/reader-core/tests/matrix.test.ts` | 件数 assert → ファイル名 assert（強化） |
| `packages/dashboard/tests/{fixtures,components,reducer}` | フィクスチャ・assert 更新 |

`count` は残さない（二重の真実を作らない）。成果物パスは
`construction/<unit>/<stage>/<filename>` を `GET /api/artifact?path=` に渡す。

## 2. モジュール（logical-components.md のモジュール表どおり）

| ファイル | 責務 | 主要 ID |
|---------|------|--------|
| `viewer/index.tsx` | `ArtifactViewer`（D1 フロー + D3 5状態）+ `ViewerToolbar`（同ファイル内サブコンポーネント） | US-13 / D1 / D3 |
| `viewer/MarkdownSurface.tsx` | データ契約 `{markdown, editable, onEdit}` の実装境界。ErrorBoundary → PlainPreview、1MB 超は即 PlainPreview、mermaid フェンス検出と委譲 | ADR-05 / D3 error(b) / P-AV-5 / S-AV-3 |
| `viewer/PlainPreview.tsx` | `<pre>` 素テキスト（`dangerouslySetInnerHTML` 不使用） | S-AV-3 |
| `viewer/MermaidBlock.tsx` | Props `{code}` のみ。動的 import + モジュールスコープ メモ化 + `securityLevel:"strict"` / `startOnLoad:false`、失敗はコード表示 | FR-6.3 / S-AV-4 / P-AV-3 |
| `viewer/AnswerEditor.tsx` | `[Answer]:` 行編集 + `SaveBar`（同ファイル内）。hostMode で**何も返さない** | US-14 / FR-6.2 / S-AV-2 |
| `viewer/services/answer.ts` | `saveAnswer()` — アプリ唯一の POST 発行点。200 → 再取得 → 対象行以外のバイト不変を `===` 1回で確認 | S-AV-1 / S-AV-5 / P-AV-4 |

付随変更:
- `services/api.ts` に `fetchArtifact(path)` と `prefetchArtifact(path)`（GET のみ。
  **POST はこのモジュールに入れない**）。P-AV-2 の「チャンク取得と読み取りの並行発火」は、
  先行取得した進行中 promise をモジュールスコープの in-flight マップで受け渡す形にする
  （コンテンツキャッシュにはしない — 開き直しは必ず再読込）。
- `viewer/artifact-path.ts`（import ゼロの葉モジュール）に `artifactPath` / `firstArtifact`。
  「セルが最初に開く成果物」の規則を DetailPanel の先行取得と viewer の初期 state で共有する。
- `components/DetailPanel.tsx` が cell 選択時に `React.lazy` で viewer を差し込み、同一 tick で
  最初の成果物を先行取得する（P-AV-1 / P-AV-2）。
  開いているファイルは **viewer のローカル state**（グローバルストアに載せない）。
- `styles/app.css` に `.viewer__*` / `.answer__*`。

## 3. 実装順（依存順）

1. 横断変更（§1）→ `tsc` と既存 598 テストが緑であることを確認
2. Milkdown 候補検証（§0）→ 実装候補を確定
3. `PlainPreview` → `MermaidBlock` → `MarkdownSurface`（下から上へ。上位は下位の契約のみ使う）
4. `services/answer.ts` → `AnswerEditor`
5. `index.tsx`（ArtifactViewer + ViewerToolbar）→ `DetailPanel` 配線
6. テスト → `bun run check` → `vite build` でチャンク分割を実測

## 4. テスト計画（team.md: 契約に対して書く / 実装内部を触らない）

| ファイル | 対象 |
|---------|------|
| `viewer-surface.test.tsx` | MarkdownSurface の Props 契約（表・mermaid 委譲・構造保持・欠落なし・read-only）、S-AV-3 の4分岐、1MB 経路、その他ブロック種 |
| `viewer-surface-crash.test.tsx` | 実行時例外 → PlainPreview（D3 error(b)）。契約点（mermaid 委譲）で fault injection |
| `viewer-mermaid.test.tsx` | 正常 / 不正 / `securityLevel:"strict"` 設定 / メモ化1回 / 不正 SVG |
| `viewer-answer.test.tsx` | バイト不変比較の一致・不一致・CRLF・範囲外、`saveAnswer` の全応答分岐、hostMode DOM 不在、5識別子 + 未知識別子 + ネットワーク失敗の default 分岐 |
| `viewer.test.tsx` | ArtifactViewer 5状態、ツールバー切替、verdict、編集ゲート |
| `detail-panel.test.tsx`（追記） | cell 選択で lazy viewer がセルの `files` で開くこと |
| `dependency-direction.test.ts`（更新） | POST 発行モジュールが **1つだけ**、`fetch` 呼出しが **2つだけ**、marked を lexer としてのみ使用、依存リスト固定 |

## 5. ゲート

`bun run check`（biome + `tsc --noEmit` ×2 + `vitest run --coverage` + `bun audit`）が全緑。
既存 598 テストを1件も壊さない（`MatrixCell` 変更で失敗するテストは assert を**強化**して直す。
弱めない）。加えて `vite build` で初期チャンクに milkdown/mermaid/viewer が入らないことを実測。
