# Logical Components — Unit: artifact-viewer

> nfr-design (3.3) / Unit: artifact-viewer / 2026-07-25
> 入力: functional-design（business-logic-model D1〜D3 / frontend-components）+ 本ステージ設計文書

## モジュール構成（packages/dashboard/src/viewer/ — dashboard パッケージ内の遅延ロード領域）

| モジュール | 責務 | 依存 |
|-----------|------|------|
| `index.tsx` | `ArtifactViewer`（D1 のフロー + 5状態切替）。dashboard-ui から動的 import される唯一のエントリ | 下記全部 |
| `MarkdownSurface.tsx` | **データ契約の実装境界**（`{markdown, editable, onEdit}`）。内部 ErrorBoundary で実行時クラッシュ → plain preview に切替（D3 error(b)）。1MB 超は最初から plain（P-AV-5）。**Mermaid フェンスの検出と MermaidBlock への委譲もここ** | milkdown（動的）/ PlainPreview / **MermaidBlock** |
| `PlainPreview.tsx` | `<pre>` による素の Markdown 表示（フォールバック実装 + 大サイズ経路） | — |
| `MermaidBlock.tsx` | mermaid の動的 import + メモ化 + `securityLevel:"strict"` 描画、失敗はコード表示。**Props は `{code: string}` のみ**（WYSIWYG 実装に非依存 — どのレンダラでも「mermaid フェンスの中身の文字列」を渡すだけ） | mermaid（動的） |
| `AnswerEditor.tsx` | `[Answer]:` 行編集 UI（hostMode で非レンダリング — S-AV-2）。**SaveBar は本ファイル内のサブコンポーネント**（別ファイルにしない — 保存ボタンと結果表示は編集 UI と不可分） | services/answer |
| （`ViewerToolbar`） | 成果物切替 / verdict バッジ / 閉じる — **`index.tsx` 内のサブコンポーネント**（別ファイルにしない。ArtifactViewer のヘッダ相当で状態を共有するため） | index.tsx 内 |
| `services/answer.ts` | `saveAnswer()`（POST /api/answer の唯一の発行点 — S-AV-1）+ 保存後の再取得・バイト不変再検証（D2） | dashboard-ui の api クライアント |

## データフロー

```
DetailPanel（dashboard-ui）──動的 import──▶ ArtifactViewer
  ├ GET /api/artifact（チャンク取得と並行）→ ViewState
  ├ MarkdownSurface（契約: markdown/editable/onEdit）
  │    ├ 通常: Milkdown 実装（HTML パススルー無効）
  │    ├ 実行時例外 / 1MB 超 → PlainPreview
  │    └ Mermaid ブロック → MermaidBlock（strict・失敗はコード表示）
  └ AnswerEditor（hostMode=false のときのみ DOM に存在）
       └ services/answer.saveAnswer → POST → 200 → 再取得 → バイト不変再検証
```

テスト: MarkdownSurface は **Props 契約に対して**（実装非依存）、AnswerEditor はゲート×エラー識別子6分岐、MermaidBlock は正常/不正/strict 設定、services/answer はバイト比較の一致・不一致。

## ADR-05 隔離の担保（swap 時に触るファイル）

WYSIWYG 候補交代（Milkdown → BlockNote → plain preview）で変更するのは **`MarkdownSurface.tsx` 1ファイルのみ**。これが成立する根拠:

- **Mermaid の埋め込みグルーは swap-generic**: MermaidBlock の Props は `{code: string}` だけで、WYSIWYG のプラグイン API に依存しない。MarkdownSurface が「mermaid フェンスを見つけて中身の文字列を MermaidBlock に渡す」責務を持つため、レンダラが変わっても MermaidBlock 自体は無改修（変わるのは MarkdownSurface 内の検出・差し込み方だけ）。
- **編集経路も契約側**: 編集は `onEdit(line, value)` コールバック1本で、AnswerEditor / services/answer は WYSIWYG を知らない。
- したがって swap の影響範囲は MarkdownSurface.tsx + tech-stack-decisions.md の該当行 + ADR-05 追記の3点（tech-stack-decisions.md の判定基準どおり）。

## Review

**Verdict:** READY

- **Finding 1 (MermaidBlock dependency + swap proof) — resolved.** モジュール表の `MarkdownSurface.tsx` 依存列に太字で `MermaidBlock` が追加され（logical-components.md:11）、データフロー図にも「Mermaid ブロック → MermaidBlock」の枝が明記されている（同 26行目）。`MermaidBlock` の Props は logical-components.md:13 と frontend-components.md:32 の両方で `{code: string}` のみと一致しており、WYSIWYG 実装非依存が明言されている。新設の「ADR-05 隔離の担保」節（33–39行目）が one-file-swap の根拠を具体的に説明: Mermaid 埋め込みグルーは swap-generic（MarkdownSurface がフェンス検出・委譲を担い MermaidBlock 自体は無改修）、編集経路も `onEdit(line, value)` 契約1本に閉じているため AnswerEditor/services/answer は WYSIWYG を知らない。tech-stack-decisions.md:18 の決定メモ（影響ファイル3点）と矛盾なく一致。
- **Finding 2 (ViewerToolbar/SaveBar) — resolved.** モジュール表に `（ViewerToolbar）` 行が追加され「index.tsx 内のサブコンポーネント（別ファイルにしない、状態共有のため）」と明記（logical-components.md:15）。`AnswerEditor.tsx` 行にも「SaveBar は本ファイル内のサブコンポーネント（保存ボタンと結果表示は編集 UI と不可分）」と明記（同14行目）。frontend-components.md のコンポーネント階層（ViewerToolbar / AnswerEditor└SaveBar、6–15行目）とファイル構成の対応が明示され、参照漏れは解消。
- **Regression check** — 新たな矛盾なし。MermaidBlock の依存方向（MarkdownSurface → MermaidBlock、逆はなし）はモジュール表・データフロー図・frontend-components.md 階層の3箇所で一貫。`securityLevel: strict` は tech-stack-decisions.md:11 の記述どおり MermaidBlock 内部に閉じており Props には現れず矛盾しない。1MB 閾値・10MB reader-core 拒否の記述も両ファイルで一致。
