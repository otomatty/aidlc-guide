# Tech Stack Decisions — Unit: artifact-viewer

> nfr-requirements (3.2) / Unit: artifact-viewer / 2026-07-25
> 入力: functional-design（データ契約・ADR-05 隔離）+ requirements.md（PRD §7）+ decisions.md ADR-05 + team-practices.md

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| WYSIWYG | ~~Milkdown (Crepe) が第一候補~~ → **交代済み（2026-07-25 / code-generation）: `marked` の lexer によるトークン→React 要素マッピング**（read-only レンダラ）。Milkdown/Crepe は M3 冒頭の5項目チェックで**項目2（Mermaid が図として描画される）が不合格**（mermaid フェンスを CodeMirror のコードブロックとして扱い、ソース行 `graph TD` が本文テキストとして出現・図ノード0件）。救済にはカスタム ProseMirror NodeView が必要で ADR-05 の「浅い統合に留める」に反するため交代。BlockNote は**計測せず**カテゴリ不一致（同じく ProseMirror ベースの編集器 = 同じ機構で項目2が不合格 / read-only 面に編集器級の重量）を理由に飛ばした。終端の plain preview は項目1・3が定義上満たせないため採らず、`marked.lexer()`（HTML を生成しない）+ React 要素で項目1/2/3を満たす。詳細と実測は ADR-05 追記（2026-07-25）および code-summary.md | PRD §7 / feasibility R-2 / ADR-05 追記 |
| Mermaid | `mermaid`（動的 import・`securityLevel: strict`） | FR-6.3 / S-AV-4 |
| 隔離 | 実装は `MarkdownSurface` の Props 契約（`{markdown, editable, onEdit}`）の内側に閉じる | ADR-05（交代コストを1コンポーネントに限定） |
| ロード | React.lazy + dynamic import（本 Unit 全体 + mermaid を個別に） | P-AV-1/3 |
| dev-time | Vitest + @testing-library/react（**契約に対するテスト** — 実装内部を触らない）+ 実 tb-lxp フィクスチャによる表示検証 + 手動ビジュアルチェックリスト | team.md（Milkdown 内部でなくデータ契約をテスト対象に） |

## 決定メモ

- 候補交代が起きた場合、変更するのは `MarkdownSurface` の実装ファイル1つ + tech-stack のこの行 + ADR-05 の追記のみ（他 Unit・他コンポーネントの変更ゼロが隔離成功の判定基準）。
  - **2026-07-25: 実際に交代が発生し、3点すべてを実施済み**（`MarkdownSurface.tsx` の中身 / 上表の WYSIWYG 行 / decisions.md の ADR-05 追記）。`MermaidBlock` / `AnswerEditor` / `services/answer.ts` / `index.tsx` / 呼出側 `DetailPanel` は無改修。他 Unit の変更はゼロ。判定基準を満たす。
- 1MB 超の成果物は plain preview 固定（P-AV-5 の本 Unit 独自閾値）。なお 10MB 超はそもそもサーバ（reader-core の readArtifact bound）が `file-too-large` で拒否するため本 Unit に届かない。
