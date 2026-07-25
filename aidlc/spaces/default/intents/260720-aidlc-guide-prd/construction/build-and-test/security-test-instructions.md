# Security Test Instructions — AIDLC Guide

> build-and-test (3.6) / lead: quality / **security 観点: devsecops** / 2026-07-25
> 入力: 各 Unit の `code-summary.md` + `nfr-design/security-design.md`（S-RC / S-DS / S-UI / S-AV / S-MM / S-OG）+ requirements.md NFR-1 / NFR-7 + project.md Mandated / Forbidden

## 脅威モデル（何から守るか）

本ツールは**ローカル専用・読み取り専用**であり、認証機構を持たない。守るべきものは3つに限られる:

| # | 資産 | 脅威 | 主防御 |
|---|------|------|-------|
| T1 | 対象ワークスペースの完全性 | ツールが aidlc 記録・state・監査ログを壊す/書き換える | 書込経路が構造的に1つだけ（`POST /api/answer` の `[Answer]:` 行のみ） |
| T2 | 記録の内容（成果物・監査。ユーザーが貼った秘密を含み得る） | `--host` / トンネル公開による意図しない開示 | 既定 loopback + 明示フラグ + 公開対象を名指しした警告 |
| T3 | 記録外のファイル | パストラバーサルによる読み出し | 全読み取り経路が `guardPath` を通る |

認証・認可は**スコープ外**（PRD §8）。代わりに「公開の可視性」で人間の判断を支える設計であり、テストはその可視性が実際に提示されるかを検証する。

## 実行

セキュリティ検証は独立コマンドを持たない。**通常のスイートと `bun audit` に組み込まれている**（team.md: ローカルゲートは1本）。

```bash
bun run check
```

`check` = `biome check . && tsc --noEmit && tsc --noEmit -p packages/dashboard && vitest run --coverage && bun audit`

個別に叩く場合:

```bash
bunx vitest run packages/reader-core/tests/guard-path.test.ts
bunx vitest run packages/reader-core/tests/guard-path-vectors.test.ts
bunx vitest run packages/docs-bridge/tests/guard-path-vectors.test.ts
bunx vitest run packages/dashboard-server/tests/answer-writer.test.ts
bunx vitest run packages/mcp-server/tests/read-artifact-gate.test.ts
bunx vitest run packages/dashboard/tests/dependency-direction.test.ts
bunx vitest run packages/reader-core/tests/dependency-direction.test.ts
bun audit
```

## S-1: 書込境界（T1 / NFR-1）

**構造的に1経路であること**を走査で検証する。規約の記述ではなくテストが enforcement point。

| 検証 | 場所 | 内容 |
|------|------|------|
| POST 発行モジュールが1つだけ | `dashboard/tests/dependency-direction.test.ts` | `viewer/services/answer.ts` のみ。他に POST を書けば失敗する |
| `fetch` を持つモジュールが2つだけ | 同上 | `services/api.ts`（GET のみ）と上記 |
| fs 書込 API の import 禁止 | `biome.json` の `noRestrictedImports` | `writeFile` / `rename` / `unlink` 等を、AnswerWriter 以外で import できない |
| AnswerWriter の5ゲート | `dashboard-server/tests/answer-writer.test.ts` | ①hostMode → 403 ②ファイル名が `*-questions.md` でない → 403 ③記録外パス → 403 ④`[Answer]:` 行でない → 403 ⑤書込後のバイト不変検証に失敗 → 500 + **ファイルを変更しない** |
| 改行注入の拒否 | 同上 | 値に `\r` / `\n` を含む要求は 400。行の増殖はバイト不変検証では巻き戻せないため境界で拒否する |
| 書込のアトミック性 | 同上 | 同一ディレクトリの一時ファイル → rename。中断しても部分書きのファイルが残らない |

**手動確認**: `bun run dashboard` 起動中に、記録配下の任意のファイルのタイムスタンプが変わらないこと（`[Answer]:` 記入を除く）。

## S-2: パス containment（T3）

`guardPath` を通らない読み取り経路を作らないことが不変条件。

- **共有ベクタ表**: `packages/docs-bridge/tests/vectors/guard-path-vectors.ts` を **reader-core と docs-bridge の両方が実行する**。docs-bridge は zero-runtime-dependency を保つため `guardPath` を意図的に複製しており、片方だけ直すとベクタ表がテスト失敗として検出する
- **ベクタ**: `../` トラバーサル / 記録外への絶対パス / 記録外を指す symlink / 正規化後に記録外になるパス / Windows のドライブレター・UNC 形
- **列挙的に検証する**。「いずれか1件が拒否される」では不十分
- symlink ベクタは作成権限が無い環境で `skipIf` により skip される（Windows で開発者モード未有効）。**skip されたことを検証済みと読まない** — 権限のある環境で必ず一度通す

MCP 側は `read-artifact-gate.test.ts` が同じ3ベクタを HTTP でなく stdio 経由で確認する。dashboard-server 側は `read.ts` の `artifact()` と reader-core の `readArtifact` で**二重に**guard する（S-DS-4 の意図的な多重防御）。書込側（`/api/answer`）は reader を通らないため guard は1箇所であり、そこが唯一の検査点になる。

## S-3: 公開範囲（T2 / NFR-7）

| 検証 | 期待 |
|------|------|
| 既定起動の bind | `127.0.0.1`。環境変数・設定ファイルから LAN 公開を有効化する経路が**存在しない**（`grep -r "process.env\|import.meta.env\|Bun.env"` が全パッケージで空） |
| `--host` の警告 | 「成果物」「監査」「秘密を含み得る」相当の語を含む。単なる「LAN に公開しました」では不足 |
| 警告の位置 | 待受アドレス一覧より**前**（読み飛ばされない位置） |
| アドレス一覧の内容 | IPv4 と port のみ。ホスト名・ユーザー名・ワークスペースパスを含まない |
| bind 失敗 | 非ゼロ終了。**loopback へフォールバックしない**（黙って公開範囲を狭めない。同様にフラグ無しで広げない） |
| `hostMode` の不変性 | プロセス起動時に確定。トグル API を持たない。クライアント側も**読み取り失敗で `false` に落ちない**（落ちると ReadOnlyBadge が消え参加者に編集 UI が復活する） |

**トンネル公開の注意**: `handleAnswer` は `ctx.hostMode` のみで判定し、接続元アドレスを見ない。したがって**`--host` を付けずにトンネルを張ると、リモート参加者に書き込みが通る**。これは実装の欠陥ではなく設計上の帰結であり、`docs/guides/live-share.md` が手順として「トンネルを張る前に `--host` を付ける」「回答記入のため `--host` を外すときは先にトンネルを閉じる」を義務づけている。**運用ガイドの記述がこの経路の唯一の防御である**ことを、ガイド変更時に忘れないこと。

## S-4: 描画の信頼境界（成果物 Markdown）

artifact-viewer は本ツールで唯一「外部由来の文書を描画する」場所。モブで貼られた内容を含み得る。

| 検証 | 場所 |
|------|------|
| 生 HTML を素通ししない | `dependency-direction.test.ts` が `marked.parse` / `parseInline` / `dangerouslySetInnerHTML` / `innerHTML` の不在を走査。レンダリング経路に HTML 文字列が**存在しない**（`marked.lexer()` → React 要素のみ） |
| インライン HTML トークン | `token.raw` を React のテキスト子として渡す = エスケープされる |
| `dangerouslySetInnerHTML` の禁止 | `biome.json` の `noDangerouslySetInnerHtml` を `packages/dashboard/src/**` に error で適用 |
| Mermaid のサニタイズ | `mermaid.initialize({ securityLevel: "strict", startOnLoad: false })` が1回だけ呼ばれること。クリックバインド・スクリプトは無効 |
| 描画失敗の扱い | 例外をクラッシュにせず plain preview / コード表示へフォールバック |

**手動確認（推奨）**: 悪意ある HTML（`<img onerror=...>`、`<script>`）と不正な mermaid を含む成果物を実ブラウザで開き、スクリプトが実行されないこと。

## S-5: 依存の健全性（サプライチェーン）

```bash
bun audit
```

- **直接依存の既知脆弱性はゲート失敗**として扱う（lint 失敗と同格。project.md Mandated）。抑制フラグで通さない
- 推移依存の脆弱性は `overrides` でのピン留めで解消する（本プロジェクトでは MCP SDK 経由の `@hono/node-server` に対して実施済み）
- `bun.lock` はコミット済みの真実。`bun install --frozen-lockfile` で乖離を検出する

SAST/DAST ツールは導入しない（team.md: ツールチェーンは Biome 単一 + Vitest。CI 基盤が無い）。上記の走査テスト群が本プロジェクトにおける静的検査の役割を果たす。

## S-6: 文書側のセキュリティ（ops-guides）

実行体を持たない Unit だが、**運用ガイドの記述ミスが実際の情報漏洩につながる**ため記述義務として検証する:

- トンネル節の**冒頭**に認証注意があること（手順の後ではない）
- 公開範囲の3段階表（loopback / LAN / トンネル）があること
- 実在のホスト名・IP・トークンを書いていないこと（`example.com` / `192.0.2.10` / `<YOUR_TOKEN>` のみ）
- 掲載するフックが「対象ブランチ明示 / 対象パスを `aidlc/` に限定 / 無条件 `--force` 不使用」の3条件を満たすこと
- 記載した警告文言が実装の定数と**逐語一致**すること

最後の1点に自動ドリフト検知は無い（意図的な決定）。実装側の警告定数を変更するときは、引用元がファイル名付きで併記されていることを手掛かりに、その作業の中でガイドを直す運用に依存する。
