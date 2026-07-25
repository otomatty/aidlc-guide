# Tech Stack Decisions — Unit: ops-guides

> nfr-requirements (3.2) / Unit: ops-guides (kind: spec) / 2026-07-25
> 入力: functional-design（G-1/G-2 の構造）+ team-practices.md + requirements.md（PRD §8: ツール本体に組み込まない）

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| 形式 | **Markdown**（`docs/guides/*.md`）。ツールに組み込まない静的文書 | PRD §8（トンネル等は手順ドキュメントとして提供）/ C8 |
| 配置 | リポジトリ内 `docs/guides/`（成果物と同じ git 管理下 — 版が揃う） | components.md C8 |
| 参照される外部製品 | VS Code Live Share / cloudflared / Tailscale / tmux（**手順を書く対象**であり本ツールの依存ではない） | PRD §8「ツール本体には組み込まない」/ FR-7.4（手順ドキュメントとして提供） |
| 検証 | 手動（受入条件のチェックリスト）+ G-2 は実行検証（US-22 AC）。**ローカル品質ゲートに文書 lint は入れない**（Markdown の体裁より内容の正しさが本質で、自動化の費用対効果が低い） | team.md（CI 基盤なし・ローカルゲートのみ） |

## 決定メモ

- 図は入れない（手順は文章 + コマンドで足りる。Mermaid の保守コストを負わない）。
- 英語版は作らない（社内チーム向け・日本語 UI と揃える）。必要になったら別途判断。
