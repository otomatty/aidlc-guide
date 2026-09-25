**Collaborator:** aidlc-developer-agent

## Contribution

開発者視点（命名・レイヤ境界・エラー処理・ファイル配置・コードスタイル）でリード草稿を CodeKB（`code-structure.md` / `architecture.md`）と肯定済み `team.md` に照らして再確認した。

### 一致している点（ベースライン維持）

- **コードスタイル**: oxlint + oxfmt、LF、言語慣習の命名、クロスプラットフォームパス、`reader-core` の UI 非依存・パーサ隔離・Result 境界は観測事実と一致。Biome / Prettier 不使用も継承で妥当。
- **レイヤ境界（Mandated）**: `dashboard` ↛ `reader-core`、docs コンテンツローダは `api-core` / `official-docs` のみ、`guardPath` + 否定 containment テスト、locale `en`/`ja`、同梱ツリー `docs/guide|reference/<locale>/`、API `/api/official-docs/:locale/*`、Bridge CTA は `open-official-doc` 再利用 — CodeKB のパッケージ DAG・レイヤ規則と一致。
- **品質ゲート単一入口**: `bun run check` への配線強制、VSIX に秘密・`.env`・`aidlc/` を含めない、bun 出荷ランタイムのみ — 既存強制と一致。
- **Way of Working / Deployment**: trunk-based + squash-merge to `main`、local-only — 変更なしで妥当。コンテンツ作業の範囲を docs-qa / Docs UI まで明示したのは本 intent 向けの加算として自然。

### ギャップ・補強提案

1. **ファイル配置の慣習が Code Style / Mandated に未固定**  
   CodeKB は docs-qa を `api-core/src/docs-qa/` + `handlers/`、UI を `dashboard/src/features/docs/`（hooks / components / shared services）に集約している。チャット画面化で新パッケージや `features/chat` 直下のドメイン読込を増やさないよう、「既存の feature フォルダ／ハンドラ分割／CLI 隔離（`ai-cli`）を踏襲する」を Code Style か Mandated に一文入れると Construction の迷いが減る。

2. **エラー処理の慣行が reader-core に偏っている**  
   Code Style の Result 境界は `reader-core` のみ。本 intent の活性面は `DocsQaResult<T>`・`hostMode`/busy 拒否・ジョブ `error`（architecture TX-Docs-QA）。ワイヤ／API 境界では Result 型または同等の明示的失敗表現を崩さない、を Code Style に継承範囲として追記すべき。

3. **命名・契約面**  
   `DocsQaRequest` / `DocsQaJob` / `docsQaApi` など既存ワイヤ名の再利用を暗黙のままにしている。並行する別名（例: chat-session 専用 DTO の二重定義）を Forbidden か Code Style で抑止すると命名ドリフトを防げる。locale / API パスの表は十分。

4. **Testing Posture の US-06 義務の軟化**  
   肯定済み `team.md` は StageCard/Bridge の excerpt 非マウントと `open-official-doc` CTA の UI/契約テストを `bun run check` に含めると明記。草稿は「触る経路に UI/契約テスト」と一般化し、強度継承を Uncertain に回している。人間が明示的に緩和するまで、既存 US-06 条項は Testing Posture（または Mandated）に残すのが brownfield 安全側。

5. **Walking Skeleton の書き換え**  
   `classic` の `skeleton: off` に合わせた「専用骨格儀式なし／通常 Bolt」はスコープと一致。ただし現行 `team.md` は Bolt 1 ソロ・ゲート継承をまだ書いている。肯定ゲートで上書きする意図なら evidence の Uncertain ではなく「肯定時に置換する差分」として明示した方がよい。

6. **Methodology: test-after**  
   `team.md` に Methodology フィールドは無く、evidence の Uncertain 扱いが正しい。草稿本文に **Methodology: test-after** を既定として書き切るのは、インタビュー前の先走り。本文は「未肯定」か Uncertain への参照に留め、肯定後にのみ固定すべき。

### 総合

レイヤ境界・スタイル・禁止事項の中核は CodeKB / `team.md` と整合しており発明は少ない。チャット画面化に向けては (a) docs-qa / `features/docs` のファイル配置、(b) `DocsQaResult` 系のエラー表現、(c) US-06 UI/契約テストの継承強度、(d) test-after の肯定タイミング、を人間ゲートで確定すれば Construction に渡せる。

## Positions

AGREE:
- oxlint / oxfmt、クロスプラットフォームパス、locale・同梱ツリー・`/api/official-docs/:locale/*`、コンテンツローダ配置、`dashboard` ↛ `reader-core`、`guardPath`、単一 `bun run check`、VSIX 汚染禁止、Bridge CTA 単一、i18n カタログ禁止。
- Way of Working（trunk + squash to `main`）と Deployment（local-only）の継続。
- 硬規則は既存強制の再掲に留め新規発明しない方針。
- docs-qa 専用 coverage 床・履歴上限ずれ・チャット UI テストの Mandated 昇格は Uncertain に残す判断。

OBJECT:
- Testing Posture に **Methodology: test-after** を本文確定するのは時期尚早。肯定前は Uncertain のままにし、肯定ゲート後にのみ `team.md` へ書く。
- 肯定済み US-06 UI/契約テスト義務を一般文言へ薄めず、人間が緩和するまで Testing Posture / Mandated に残す。
- Code Style（または Mandated）に、docs-qa は `api-core` の既存配置＋ dashboard は `features/docs` 踏襲、および `DocsQaResult`（または同等の明示的失敗）を API/ワイヤ境界で崩さない、を追記する。
- Walking Skeleton を `skeleton: off` 前提へ書き換えるなら、現行「Bolt 1 ソロ・ゲート継承」との差分を肯定対象として明示する。
