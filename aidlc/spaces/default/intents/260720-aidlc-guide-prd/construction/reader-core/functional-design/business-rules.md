# Business Rules — Unit: reader-core

> functional-design (3.1) / Unit: reader-core / 2026-07-23
> 入力: requirements.md（FR-1/NFR-1/NFR-6）+ components.md C2 + team-practices.md 構造規約 + 実 State Version 8 ファイルの観測（2026-08-14 に 2.6.2 へ再適用）

## パース文法規則（State Version 8 — 実ファイル観測に基づく）

| ID | 規則 |
|----|------|
| G-1 | セクションは `## <見出し>` で区切られる行指向 Markdown。フィールドは `- **<名前>**: <値>` 形式 |
| G-2 | **State Version 検知**: `## Project Information` 内の `- **State Version**: <n>`。n≠8 または欠落 → 即 `{unsupported, version}`（以降のパースを試みない — 誤読より明示拒否 C-T3） |
| G-3 | **Stage Progress**: `- [<mark>] <slug> — <EXECUTE\|SKIP>` 行。mark ∈ {` `, `-`, `?`, `R`, `x`, `S`} → StageStatus へ写像（[ ]=not-started, [-]=in-progress, [?]=awaiting-approval, [R]=revising, [x]=completed, [S]=skipped）。未知 mark はその行を unparseable マークし継続 |
| G-4 | フェーズ見出しは `### <PHASE> PHASE` 行。既知5フェーズ以外は無視（前方互換の余地を残さない — 未知構造は G-2 の Version 検知で先に弾かれる前提） |
| G-5 | 完了数 `done` は `## Execution Plan Summary` の `- **Completed**: <n>` を優先し、欠落時は checkbox の [x]+[S] 集計にフォールバック（表示は常に可能に） |
| G-6 | 総数 `total` は `## Execution Plan Summary` の `- **Total Stages**: <n>` を優先し、欠落時は Stage Progress の EXECUTE 行数にフォールバック。**両方あって不一致の場合はフィールド値を採用し `warnings` に不一致を記録**（state はエンジンの所有物 — reader は読むだけで正誤判定しない。不一致は UI で警告可視化できる） |

## 動作規則

| ID | ルール | 出所 |
|----|--------|------|
| BR-RC-1 | **読取専用**: いかなる書込 API も持たない（fs の read 系のみ import。Biome restricted-imports で構造禁止） | NFR-1 / Forbidden |
| BR-RC-2 | **throw 禁止**: 公開境界は全て ReadResult。内部例外は境界で捕捉し `{error, reason}` へ変換 | team.md 規約3 |
| BR-RC-3 | **UI/トランスポート非依存**: React・MCP SDK・HTTP/WS を import しない（依存方向テストで検証） | team.md 規約1 |
| BR-RC-4 | **Version 依存は parse/ のみ**: G-1〜G-6 の知識を parse/ の外に漏らさない。tree/audit は構造非依存の走査 — **唯一の例外**: tree/ の「ステージ横断ディレクトリ除外」は L1 がパースした CONSTRUCTION ステージ slug 集合を**引数で受け取る**（ハードコード禁止。知識の出所は parse/ のまま、tree/ はデータとして使うのみ — scope 変更で自動追従） | team.md 規約2 / NFR-6 |
| BR-RC-5 | **局所縮退**: 要素級の失敗は該当要素のみ理由付きでマークし、健全部分を返す。全体 error は入口級のみ | NFR-6 / US-15 |
| BR-RC-6 | **監査 JSONL・成果物の本文をモデルに保持しない**: 必要フィールドのみ抽出（メモリと機微情報の両面。本文は read_artifact が都度読む） | NFR-5 / 設計整合 |
| BR-RC-7 | **パス処理はクロスプラットフォーム**: `node:path` のみ、`path.sep` 決め打ち禁止、比較は正規化後 | NFR-4 / team.md |

## 5失敗モード → 表現（US-15 対応表）

| モード | 検知箇所 | 表現 |
|--------|---------|------|
| ① アクティブインテント未解決 | L4 | `{ok, {active:null, all}}` — エラーでなく正常形（UI が EmptyState/IntentPicker を出す） |
| ② 複数インテント列挙 | L4 | `all[]` に全件（cursor 有無と独立に常時提供） |
| ③ state パース不能 | L1/G-2 | `{unsupported, version}` or `{error, reason}` — フィールド級は unparseable マーク |
| ④ 成果物の部分欠落 | L2 | 該当 `cell.error` のみ、他セル正常 |
| ⑤ 監査シャード読取不能 | L3 | 該当シャード skip + warnings、他シャード正常 |
