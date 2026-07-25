# Security Design — Unit: artifact-viewer

> nfr-design (3.3) / Unit: artifact-viewer / 2026-07-25
> 入力: nfr-requirements/security-requirements.md（S-AV-1〜5）+ functional-design（D2・データ契約）

## 設計（要件→機構）

| 要件 | 実現機構 |
|------|---------|
| S-AV-1（書込1経路） | `saveAnswer(file, line, value)` 関数1つだけが POST を発行（他モジュールから fetch を直接呼ばない — Biome で fetch 直呼び禁止、api ラッパ経由に強制） |
| S-AV-2（hostMode で DOM 不在） | `AnswerEditor` を条件レンダリング（`hostMode ? null : <AnswerEditor/>`）。CSS の display:none ではなく**要素を返さない**（DOM 不在の要件 — US-11） |
| S-AV-3（生 HTML 素通し禁止） | MarkdownSurface のレンダラ設定で HTML パススルーを無効化（Milkdown: html ノードを無効化 / plain preview: `textContent` 代入）。`dangerouslySetInnerHTML` は Biome で本パッケージ禁止 |
| S-AV-4（Mermaid サニタイズ） | `mermaid.initialize({ securityLevel: "strict", startOnLoad: false })`。クリックバインド・スクリプトを無効化。描画は SVG 生成 API 経由で DOM に挿入 |
| S-AV-5（差分の非露出） | 保存後比較の結果はブール（一致/不一致）のみ UI に渡す。比較対象の文字列をメッセージに含めない |

## 信頼境界

`GET /api/artifact` が返す Markdown が唯一の外部由来入力（自チームの成果物だが、モブでの貼り付け内容を含み得る + LAN 公開時は不特定閲覧者に届く）。境界処理は S-AV-3/4 の2点に集約し、そこを通らない描画経路を作らない。
