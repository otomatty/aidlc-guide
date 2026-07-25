# Phase Boundary Verification — Construction → Operation

> ci-pipeline (3.7) Step 6 / lead: pipeline-deploy / 2026-07-26
> 対象: Construction フェーズ全体（functional-design 3.1 → nfr-requirements 3.2 → nfr-design 3.3 → code-generation 3.5 → build-and-test 3.6 → ci-pipeline 3.7）
> 判定基準: ①アーキテクチャ → コード → テストの整合 ②全コードが設計に遡れる ③受入基準に対するテストの被覆

## 判定: **PASS**（残件は明示・偽装なし）

| 検査 | 結果 |
|------|------|
| ① アーキテクチャ ↔ コードの整合 | ✅ 7パッケージ構成が application-design components.md どおり。構造規約3点は構造的に強制されている |
| ② コード → 設計へのトレーサビリティ | ✅ 9 Unit すべてが `functional-design → nfr-requirements → nfr-design → code-generation` の連鎖を持つ |
| ③ 受入基準に対するテスト被覆 | ✅（自動化可能な範囲）+ ⏳ 手動7件 |
| レビュー verdict | ✅ 全 Unit の最終判定が READY |
| 品質ゲート | ✅ `bun run check` exit 0 |

## ① アーキテクチャ → コード

application-design（ADR-01〜05）と実装の対応:

| 設計 | 実装 | 検証手段 |
|------|------|---------|
| 7パッケージ構成（components.md） | `packages/{shared-types,reader-core,docs-bridge,dashboard-server,dashboard,mcp-server,btw}` | ディレクトリ実在 |
| reader-core は UI/トランスポート非依存（team.md 規約1） | React / MCP SDK / HTTP を1つも import しない | `reader-core/tests/dependency-direction.test.ts` が走査で強制 |
| State-Version パーサを単一の差し替え可能モジュールに隔離（規約2） | `reader-core/src/parse/state.ts` のみが版形式を知る | 同上 + `parse/**` の branch 95% 強制 |
| パース境界は Result を返し throw しない（規約3） | `{ok} \| {unsupported} \| {error}` の判別可能ユニオン | `parse-state.test.ts` が variant ごとに検証 |
| ADR-03 段階的初回描画 | `GET /api/workflow` は state 1枚のみ。593ファイル走査は背景 + `matrix-ready` push | `read-handlers.test.ts` が matrix キーの不在を検証 |
| ADR-04 Mob は dashboard-server の動作モード（新プロセスなし） | `--host` の1分岐。新パッケージ・新プロセスなし | `server-smoke.test.ts` |
| ADR-05 WYSIWYG を1コンポーネントに隔離 | `MarkdownSurface.tsx` の Props 契約の内側 | 候補交代を実際に1ファイル + 文書2点で完了させたことが実証 |

**設計に無いものが実装に入っていないか**: `git ls-files packages/` の全ソースが上記7パッケージ配下にある。設計外のパッケージ・プロセス・外部サービス依存は無い（`bun audit` の依存木にクラウド SDK 無し）。

## ② コード → 設計へのトレーサビリティ

9 Unit すべてが完全な連鎖を持つ:

| Unit | パッケージ | 最終 verdict |
|------|-----------|------------|
| reader-core | `packages/reader-core` | READY |
| docs-bridge | `packages/docs-bridge` | READY（iteration 2 で解消） |
| mcp-server | `packages/mcp-server` | READY |
| btw | `packages/btw` | READY |
| dashboard-server | `packages/dashboard-server` | READY |
| dashboard-ui | `packages/dashboard` | READY |
| artifact-viewer | `packages/dashboard/src/viewer/**` | READY（iteration 2 の NOT-READY は最終処置節で解消） |
| mob-mode | `dashboard-server` + `dashboard` に跨る4ファイル | READY（iteration 2） |
| ops-guides | `docs/guides/*.md`（kind: spec） | READY（iteration 2） |

**Unit ≠ パッケージ**である点に注意（mob-mode と artifact-viewer は既存パッケージへの追加、ops-guides は文書）。これは units-generation の設計どおりで、逸脱ではない。

構造検査の総数: `**Verdict:**` 行 36件中、NOT-READY 5件はいずれも**同一ファイル内の後続イテレーションまたは最終処置節で READY に解消済み**。未解消の NOT-READY は0件。

## ③ 受入基準 → テスト

requirements.md の FR 33件 / NFR 7件、stories.md の US 22件に対して:

| 領域 | 自動検証 | 備考 |
|------|---------|------|
| FR-1（reader-core） | ✅ 12テストファイル | パーサは branch 95% 強制 |
| FR-2（MCP 5ツール） | ✅ 実 stdio smoke + 記録外パス3ベクタ | |
| FR-3（btw） | ✅ 5テストファイル | macOS 経路のみ手動（MA-7） |
| FR-4（Dashboard） | ✅ 17テストファイル | FR-4.1 は AC 修正済み（`unit` を削除 — state に該当フィールドが無いため） |
| FR-5（docs-bridge） | ✅ cross-consumer 整合 | docs 未配置環境では data-lint が skip |
| FR-6（WYSIWYG / 回答記入） | ✅ 契約テスト + 5ゲート + バイト不変検証 | **項目2（mermaid 実描画）のみ未確認**（MA-6） |
| FR-7（Mob） | ✅ bind / 警告 / 403 / LiveStatus 4状態 | LAN 到達性は別端末必要（MA-1/2/3） |
| FR-8（運用ガイド） | ✅ 手順を実行して検証（スクラッチ repo で全5経路） | 外部製品のコマンド形は未検証（ガイドに明記） |
| NFR-1（読み取り専用） | ✅ 走査テストで POST 1経路・fs 書込 import 禁止を強制 | |
| NFR-2 / NFR-3（性能） | ⏳ 機構は実装・検証済み。**秒数は未計測** | performance-validation (4.6) |
| NFR-4（クロス OS） | ⏳ Windows のみ実行 | MA-7 / workflow の macos ランナー |
| NFR-5（bun のみ） | ✅ 依存木にランタイム追加なし | Vitest は dev-time（project.md Decided） |
| NFR-6（解析不可の局所縮退） | ✅ 5失敗モードそれぞれ専用フィクスチャ | |
| NFR-7（公開の可視性） | ✅ 警告文言・順序・アドレス形・bind 失敗の致命性 | |

### 契約側の修正（実装ではなく AC を直した1件）

FR-4.1 / US-01 の Now strip AC が「ユニット」表示を要求していたが、`aidlc-state.md` に現在ユニットを示すフィールドが存在せず reader が返せないため、**AC から削除**した（2026-07-25）。進行中ユニットの可視化は FR-4.3 の Unit×Stage マトリクスが担う。実装を歪めるより契約の誤りを直す判断であり、記録に残している。

## 品質ゲートの状態（c40ac24 時点）

```
bun run check → exit 0
  Biome         155ファイル・指摘なし
  tsc ×2        エラーなし
  Vitest        52ファイル / 685 passed / 2 skipped / 0 failed
                Statements 96.53% / Branches 92.60% / Functions 96.78% / Lines 97.73%
  bun audit     脆弱性なし
```

pre-push フックは**否定側（型エラーを仕込んで exit 1）と肯定側（クリーンで exit 0）の両方**で実行検証済み。

## Operation フェーズへ持ち越す残件

| ID | 内容 | 引き継ぎ先 |
|----|------|-----------|
| MA-1 / MA-2 / MA-3 | LAN 到達性（既定で不達 / `--host` で到達）と参加者 DOM の編集要素0件 | モブ運用の初回。別端末が必要 |
| MA-4 | 参加者側の反映時間が NFR-3 内 | performance-validation (4.6) |
| MA-6 | FR-6.1 項目2 — mermaid が図として描画されること | 実ブラウザ。**証拠が非対称**（Milkdown は実測で落としたが後継は jsdom モック越し） |
| MA-7 | btw の macOS 経路 | macOS 実機、または workflow の macos ランナー |
| — | symlink containment ベクタ | symlink 作成権限のある環境 |
| — | GitHub Actions workflow の初回実行 | リモート設定後。**未検証のまま同梱** |
| — | cold start で `hostMode` 不明の窓 | `AppState.hostMode` を `boolean \| null` にする契約変更。後続パスで判断 |
| — | NFR-2 / NFR-3 / P-AV-2..4 の秒数 | performance-validation (4.6) |

いずれも「通ったことにしていない」。Operation フェーズはこの表を出発点にする。

## 結論

Construction フェーズの成果物は設計に遡れ、自動化可能な受入基準は検証され、唯一の品質ゲートは緑である。**PASS** と判定し、Operation フェーズ（performance-validation 4.6）へ進む。残件8件は上表のとおり明示され、いずれも自動検証で代替できない性質のものである。
