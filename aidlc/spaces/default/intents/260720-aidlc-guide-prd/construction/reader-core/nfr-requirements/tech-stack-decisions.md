# Tech Stack Decisions — Unit: reader-core

> nfr-requirements (3.2) / Unit: reader-core / 2026-07-24
> 入力: functional-design 3文書 + requirements.md（NFR-5）+ team-practices.md + decisions.md ADR-01/02

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| パッケージ | `packages/shared-types`（型のみ）+ `packages/reader-core` | ADR-01 / Q2 同梱 |
| ランタイム依存 | **chokidar のみ**（watch/）。パースは手書き行指向（Markdown パーサ不採用 — G 規則は行フォーマット固定で full AST は過剰） | NFR-5 依存最小 / PRD §7 |
| fs API | `node:fs/promises` の read 系 + `Bun.file` 併用可（read 系のみ — S-RC-1） | クロスランタイム互換の広い側に寄せる |
| パス | `node:path`（sep 決め打ち禁止） | NFR-4 / BR-RC-7 |
| dev-time | Vitest（ブランチカバレッジ v8）+ tb-lxp fixture（コミットピン）+ Biome | team.md |

## 決定メモ

- **Markdown ライブラリ不採用の根拠**: G-1〜G-6 は「行頭パターン6種」の抽出であり、remark 等の AST は依存・速度・攻撃面すべてで不利。将来 state 形式が構造化（YAML/JSON）されたら parse/ ごと差し替え（BR-RC-4 の隔離が効く）。
- **chokidar 採用の根拠**: PRD §7 指定 + クロスプラットフォーム実績（feasibility）。bun ネイティブ `fs.watch` は再帰・rename 挙動の OS 差が大きく、593ファイル規模の実績がある chokidar を採る。
- shared-types はランタイムコードゼロ（型のみ）— ビルド成果物に含まれない。
