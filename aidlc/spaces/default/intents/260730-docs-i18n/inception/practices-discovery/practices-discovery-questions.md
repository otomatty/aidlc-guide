# Practices Discovery — インタビュー（再実行）

> ステージ: practices-discovery (Inception 2.2) / Intent: `260730-docs-i18n`  
> 既定ベースライン: `aidlc/spaces/default/memory/team.md`（先行 intent で肯定済み）  
> Lead draft + quality / developer / devsecops の指摘を踏まえ、**未確定の差分だけ**を確認します。  
> 各 `[Answer]:` に記入してください。

---

## Q1. Walking Skeleton（この feature）

docs-i18n の Bolt 1 はどう扱いますか？

- A. `skeleton: on` — Bolt 1 はソロ・ゲート付きの薄いスライス（例: スナップショット1本を読んで Docs Shell に1ページ出す）を先に証明し、人間承認後に続行
- B. `skeleton: off` — M5 スナップショット取り込みを通常 Bolt として開始（skeleton 儀式なし）
- C. team.md の既定（Dashboard Now strip 系）をそのまま流用し、docs 用の新しい skeleton 定義は作らない
- X. その他（具体的に記入）

[Answer]: C

## Q2. Locale resolver のカバレッジ床

新しい locale 解決／コンテンツ読込モジュールのテスト床は？

- A. reader-core parse と同様 **branch coverage 95%** を Must にする
- B. UI 層並み **line ~80%** で足りる
- C. 特別床は設けず、既存パッケージ既定に従う
- X. その他（具体的に記入）

[Answer]: A

## Q3. VSIX サイズゲート

同梱 en/ja 後の VSIX サイズをどう扱いますか？

- A. 数値予算を決め、`bun run check` に **enforce**（超えたら fail）
- B. 当面は **advisory** スクリプトのみ（予算は後で決める）
- C. NFR ステージまでサイズ監視はしない（feasibility Q7 = A を維持）
- X. その他（具体的に記入）。予算 MB があれば併記

[Answer]: C

## Q4. Locale コード形式

- A. 短いコード `en` / `ja`（ツリー・API・UI で一貫）
- B. フルタグ `en-US` / `ja-JP`
- X. その他（具体的に記入）

[Answer]: A

## Q5. 同梱ツリーレイアウト（`docs/guides` 衝突回避）

- A. `docs/guide/<locale>/...` と `docs/reference/<locale>/...`（locale が中段）
- B. `docs/guide/<locale>/` ではなく `docs/official/<locale>/guide|reference/...`
- C. `docs/aidlc-workflows/<locale>/guide|reference/...`
- X. その他（具体的に記入）

[Answer]: A

## Q6. 公式 docs の API プレフィックス

既存 `/api/guides`（製品ガイド）および `/api/docs-settings` と衝突しない形は？

- A. `/api/official-docs/:locale/*`
- B. `/api/guide/:locale/*` と `/api/reference/:locale/*`
- C. `/api/docs/:locale/*`（docs-settings との衝突リスクを承知で）
- X. その他（具体的に記入）

[Answer]: A

## Q7. 既存 team.md プラクティスの継承

Way of Working / Testing（Vitest）/ Deployment（local-only）/ Code Style（Biome）は？

- A. **すべて継承** — docs-i18n 用の差分は上記 Q1–Q6 と discovered-rules のみ
- B. 一部改訂が必要 — 改訂箇所を記入
- X. その他（具体的に記入）

[Answer]: A

## Q8. Extension ホストのパス containment テスト

bundled docs を拡張ホスト経由で読む経路について（devsecops OBJECT）:

- A. Must — locale コンテンツルート + `guardPath` の否定テスト（わざと逃げるパス）を `bun run check` 対象に含める
- B. Should — 実装時に書くが、初期ゲート床にはしない
- C. 既存 guardPath テストで足りる（追加必須にしない）
- X. その他（具体的に記入）

[Answer]: A

---

## Q9. Learnings (§13) — keep as project practices?

- A. c1 — practices 再実行は docs-i18n 差分インタビューに絞る
- B. c2 — 統合結果（95% locale / official-docs API / containment Must / VSIX size→NFR）
- C. None
- X. その他

[Answer]: C

## Q10. Anything to add for next time?

- A. Nothing to add
- B. Add a note（具体的に記入）
- X. その他

[Answer]: A
