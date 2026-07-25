# Tech Stack Decisions — Unit: btw

> nfr-requirements (3.2) / Unit: btw / 2026-07-23
> 入力: business-logic-model.md + requirements.md（NFR-5）+ team-practices.md（bun/Biome/Vitest）+ decisions.md ADR-01

## スタック

| 領域 | 選定 | 理由 |
|------|------|------|
| ランタイム | bun（単体実行 `bun run btw` / bin スクリプト） | C-T1（出荷ランタイムは bun のみ）。ADR-01 のモノレポ内 `packages/btw` |
| 言語 | TypeScript | チーム標準 |
| プロセス起動 | `Bun.spawn`（引数配列） | S-BTW-2（文字列連結禁止）。クロスプラットフォーム API |
| パス処理 | `node:path` + `os.homedir()` | NFR-4 / BR-4（`path.sep` 決め打ち禁止） |
| 外部依存 | **ゼロ**（bun ビルトインのみ。引数パースも手書き — 4オプションに argparse ライブラリは過剰） | NFR-5 依存最小 / ponytail: 数行で書けるものに依存を足さない |
| dev-time | Vitest（parse/slug/resolve/plan の純関数テスト）+ Biome | team.md（C-T1 非抵触 — project.md Decided） |

## 決定メモ

- 引数パース自作の上限: オプションが 8 個を超えたら `util.parseArgs`（node ビルトイン）へ移行を検討（依存は増やさない）。
- `open -a Terminal` / `cmd start` の spawn 相当はコード生成時に両OSで実挙動確認（R-BTW-4 スモークの対象）。
