# Wireframes — AIDLC Guide（低忠実度）

> ステージ: rough-mockups (Ideation 1.6) / 作成日: 2026-07-22
> 入力: intent-statement.md（3ペルソナ均等・S-1北極星）+ scope-document.md（F-01〜F-08 全Must・依存順M1→M4）+ intent-backlog.md（proto-Unit PU-01〜PU-13）
> 回答: デスクトップ単一 / Now strip主役 / 右サイドパネル / WCAG 2.1 AA / 参加者ビュー=同一+バッジ / ライト・ダーク両対応 / 色+アイコン併用
> 忠実度: 低（構造とレイアウト意図の確定が目的。ピクセル・具体色は refined-mockups で確定）

これらのワイヤーは PRD §5 の Dashboard（F-04）を主対象とする。MCP（F-02）・btw（F-03）は非UI（CLI/エージェント応答）のため §5 に System Interaction 図を置く。

---

## 画面一覧（Information Architecture）

| # | 画面 / 領域 | 由来 | 説明 |
|---|------------|------|------|
| S-1 | Dashboard メイン（3ペイン） | F-04 | Now strip + Stage rail + Unit×Stage マトリクス。起動時の既定ビュー |
| S-2 | 詳細サイドパネル（右） | F-04/F-06 | ステージ解説カード or 成果物 WYSIWYG ビューア。S-1 の右に重ねて開く |
| S-3 | モブ参加者ビュー | F-07 | S-1 と同一レイアウト + read-only バッジ。編集UI非表示 |
| S-4 | 空 / 解析不可 状態 | NFR-6 | インテント未解決・パース不能時のフォールバック表示 |

デスクトップ単一想定（回答Q1）。最小幅の目安 1280px。3ペインは左=ナビ薄／中=主コンテンツ／右=詳細パネル（開閉）。

---

## S-1: Dashboard メイン

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AIDLC Guide          intent: 260719-tb-lxp-mvp ▼      [◐ theme]  [? help]  │ ← header (landmark: banner)
├──────────────────────────────────────────────────────────────────────────┤
│ NOW  ● CONSTRUCTION  ›  code-generation (3.5)  ›  unit: reader-core        │ ← Now strip（主役・Q2-A）
│      Depth: Standard   Gate: ◔ awaiting approval    Done 15 / 22           │   (landmark: section "現在地" — header直下・main の外)
├───────────────┬──────────────────────────────────────────────────────────┤
│ STAGE RAIL    │  UNIT × STAGE マトリクス                                   │  ← 下段全体が <main>
│ 主オリエンテ  │  従・詳細ドリルダウン                                      │    rail=第一 / matrix=従
│ ーション nav  │  section aria-label="成果物マトリクス"                    │    (Q2-A: Now strip→rail→matrix)
│               │         3.1  3.2  3.3  3.5  3.6                            │
│ IDEATION      │  reader-core  ✔2  ✔1  ✔1  ◐3   –                          │
│  ✔ intent     │  reader-watch ✔1  ·   ·   ○    –                          │
│  ⊘ market(SKIP)│  mcp-server   ✔2  ✔1  ·   ○    –                          │
│  ✔ feasibility│  dashboard    ·   ·   ·   ·    –                          │
│  ● scope ◀    │  ...                                                       │
│  ✔ rough-mock │  凡例: ✔完了(緑) ◐進行(青) ◔ゲート待ち(黄) ○未 ·空 –対象外│
│  ⊘ approval   │        ✔n = 成果物n件 / READY・NOT-READY はセル内バッジ    │
│               │                                                            │
│ INCEPTION     │  （セルクリック → S-2 右パネルにそのユニット×ステージの    │
│  ○ practices  │    成果物一覧・レビュー verdict を開く）                    │
│  ○ req-analysis│                                                           │
│  ...          │                                                            │
│               │                                                            │
│ ▸ SKIP (5) 折りたたみ  ← クリックで展開、各SKIP理由（スコープ由来）表示    │
└───────────────┴──────────────────────────────────────────────────────────┘
```

**アクセシビリティ note（S-1）** / **プロミネンス階層（Q2-A）**: h1 = "AIDLC Guide"（header）。**視覚・意味・タブ順の優先度は Now strip →（直下）Stage rail → マトリクス**（Q2-A の「Now strip を主役、その直下に Stage rail」を DOM とフォーカス順で担保。matrix を主役にする選択肢Cは不採用）。Now strip = header 直下・全幅の `<section aria-label="現在地">` 内 h2（起動時フォーカスはここ、現在地の一次情報）。下段全体を `<main>` とし、その中で **Stage rail = 第一の `<nav aria-label="ステージ一覧">`（主オリエンテーション。読み上げ・タブ順で matrix より先）**、**マトリクス = 従の `<section aria-label="成果物マトリクス">` 内 `<table>`（ドリルダウン詳細。行/列ヘッダ th、verdict は `aria-label` テキスト付き）**。キーボード: Tab で header→Now strip→**rail→matrix の順**、rail/matrix 内は矢印キー移動、Enter で S-2 展開。状態は色 + 記号（✔◐◔○）併用で色覚非依存（Q7-A）。

**状態色 + 記号の対応（Q7-A / WCAG）**:

| 状態 | 色（意図） | 記号 | ラベル |
|------|-----------|------|--------|
| 完了 | 緑 | ✔ | completed |
| 進行中 | 青 | ◐ | in progress |
| ゲート待ち | 黄/琥珀 | ◔ | awaiting approval |
| 未着手 | 灰 | ○ | not started |
| SKIP | 薄灰・破線 | ⊘ | skipped (scope) |

---

## S-2: 詳細サイドパネル（右・Q3-A）

Stage rail のステージ、またはマトリクスのセルをクリックすると、S-1 を保ったまま右から開く。2形態：

### S-2a: ステージ解説カード（rail クリック時 / FR-4.4）

```
                                      ┌───────────────────────────────────┐
   （S-1 は左に残る）                 │ code-generation (3.5)      [✕ 閉]│
                                      │ Construction · lead: developer     │
                                      ├───────────────────────────────────┤
                                      │ 目的（初学者向け平易解説）         │
                                      │  設計を実際のコードに変換する…     │
                                      │                                    │
                                      │ 入力 → 出力                        │
                                      │  functional-design → source, tests │
                                      │ 担当エージェント: aidlc-developer  │
                                      │ ゲートで人間に求められること:      │
                                      │  Bolt の承認（コード+テスト一括）  │
                                      │                                    │
                                      │ [📖 公式ドキュメントを開く →]      │ ← Docs Bridge deep-link (F-05)
                                      └───────────────────────────────────┘
```

### S-2b: 成果物 WYSIWYG ビューア（マトリクスセル / 成果物クリック時 / F-06）

```
                                      ┌───────────────────────────────────┐
                                      │ reader-core / functional-design ▼ │ ← 同ユニット×ステージの成果物切替
                                      │ business-logic.md   [READY ✔]  [✕]│
                                      ├───────────────────────────────────┤
                                      │  # ドメインルール                  │  WYSIWYG レンダリング
                                      │  ...                               │  (Milkdown / Crepe)
                                      │  ┌─ Mermaid 図 ────────┐          │  Mermaid はレンダリング(FR-6.3)
                                      │  │  A ──▶ B ──▶ C       │          │
                                      │  └─────────────────────┘          │
                                      │                                    │
                                      │  既定 read-only。*-questions.md の │  唯一の書き込み経路(FR-6.2)
                                      │  [Answer]: 欄のみ編集可（該当時）  │
                                      └───────────────────────────────────┘
```

**アクセシビリティ note（S-2）**: パネルは `role="complementary" aria-label="詳細"`。開いた瞬間フォーカスを見出し（h2）へ移動、Esc で閉じて元のトリガ要素へフォーカス復帰。deep-link は `<a>`。ビューアは read-only 領域を `aria-readonly`、編集可の Answer 欄のみ `contenteditable`＋明示ラベル。

---

## S-3: モブ参加者ビュー（F-07 / Q5-A）

S-1 と同一レイアウト。差分は最小：

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AIDLC Guide   [👁 READ-ONLY · 参加者ビュー]   driver: 260719-tb-lxp-mvp   │ ← read-only バッジ（明示）
├──────────────────────────────────────────────────────────────────────────┤
│ NOW  ● CONSTRUCTION  ›  code-generation (3.5)  ›  unit: reader-core        │
│  （以下 S-1 と同一。WebSocket push でドライバーの状態変化が即時反映 FR-7.2）│
│  相違点: [Answer] 編集欄は非表示（FR-6.2 の編集も無効 FR-7.3）             │
└──────────────────────────────────────────────────────────────────────────┘
```

**アクセシビリティ note（S-3）**: read-only バッジは装飾でなく `role="status"` テキスト。状態更新（push）は `aria-live="polite"` で読み上げ。編集UIは DOM から除去（非表示でなく不在）。

---

## S-4: 空 / 解析不可 状態（NFR-6 フォールバック）

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AIDLC Guide                                                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   （インテント未解決）  アクティブインテントが見つかりません。             │
│                         aidlc/spaces/<space>/intents/ を確認するか、       │
│                         インテントを選択してください。 [インテント一覧 ▼] │
│                                                                            │
│   （解析不可の例）      ⚠ scope-definition/scope-document.md を解析できま  │
│                         せんでした（State Version 不一致の可能性）。       │
│                         該当箇所のみ「解析不可」表示、他は通常表示。       │
└──────────────────────────────────────────────────────────────────────────┘
```

**設計意図（NFR-6）**: パース不能でも全体は落とさず、該当セル/カードだけ「解析不可」バッジにする。局所的縮退であって全画面エラーにしない。

**アクセシビリティ note（S-4）**: フォールバックメッセージは `<main>` 内の h2（例「アクティブインテントが見つかりません」）+ 説明文で構成。インテント未解決時は `<main>` 内に `role="alert"`（初回表示は能動的に読み上げ）、「インテント一覧」は `<button>`/`<select>` でページ内の最初のフォーカス可能要素とし、Tab 1回・Enter で到達・展開できる。局所的「解析不可」バッジは該当要素に `role="status"` + テキストラベル（色のみに依存しない、Q7-A整合）。キーボード導線: header→（未解決時は）インテント一覧コントロール、通常表示に混在する解析不可バッジは Tab 順で該当セルに到達。

---

## System Interaction 図（非UIサーフェス: F-02 MCP / F-03 btw）

Dashboard 以外の2サーフェスは UI を持たず、AI セッション / CLI 経由で同じ aidlc-reader モデルを参照する（PRD §4「1ライブラリ・3サーフェス」）。

```
                        ┌──────────────────────┐
                        │   aidlc-reader (F-01) │  ← 状態モデルの単一ソース
                        │  state/成果物/監査parse│
                        └───────┬──────┬────────┘
              参照(read-only)   │      │   参照(read-only)
          ┌───────────────────┘      └────────────────────┐
          ▼                                                ▼
 ┌──────────────────┐                            ┌────────────────────┐
 │  MCP サーバー F-02│  ← 本線/サイドセッションの │  Dashboard  F-04     │
 │  aidlc_status     │    Claude Code が stdio で │  (S-1〜S-4 上記)      │
 │  explain_stage    │    5ツール呼び出し         │                      │
 │  next_steps       │                            └────────┬───────────┘
 │  read_artifact    │                                     │ file監視→WS push
 │  glossary         │                            ┌────────▼───────────┐
 └────────┬─────────┘                            │  Mob 参加者 S-3      │
          │ explain/glossary は                   └────────────────────┘
          ▼ docs対応表を参照
 ┌──────────────────┐        ┌──────────────────────────────────────┐
 │ Docs Bridge F-05 │        │  btw ラッパー F-03（非UI・CLI）        │
 │ slug→docs 対応表 │        │  btw / btw --fork / btw -p "<Q>"       │
 │（単一所有 PU-08） │        │  読み取り専用サイドセッションを起動    │
 └──────────────────┘        └──────────────────────────────────────┘
```

**設計意図**: docs 対応表は Docs Bridge（PU-08）が単一所有し、MCP の explain_stage/glossary と Dashboard のステージカードが同じ表を参照する（intent-backlog.md: 「PU-09 は docs-bridge への統合により欠番」= 対応表の所有を PU-08 単一に集約、他は参照のみ）。btw は Claude Code 標準のセッション機構の薄いラッパーで、独自 UI を持たない。

---

## テーマ方針（Q6-A）

ライト/ダーク両対応・OS 設定追従。低忠実度のため具体トークンは refined-mockups で確定。原則のみ：落ち着いた開発者ツール配色、状態色（緑/青/黄/灰）はライト・ダーク双方で WCAG AA コントラスト比（テキスト 4.5:1、非テキスト 3:1）を満たす値を選ぶ。色は常に記号/ラベルと併用（Q7-A）するため、色覚差があっても状態判別は色に依存しない。

---

## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Date:** 2026-07-22

- **Finding 1 — S-4 missing accessibility note: RESOLVED.** L152 の `**アクセシビリティ note（S-4）**` は h2 見出しレベル・`<main>` ランドマーク・「インテント一覧」コントロールへのキーボード到達経路（Tab 1回・Enter）を明示している。
- **Finding 2 — Q2 fidelity (S-1 prominence): RESOLVED.** L55 のアクセシビリティ note が `Now strip →（直下）Stage rail → マトリクス` の優先順位を明記し、`下段全体を <main> とし、その中で Stage rail = 第一の <nav>...、マトリクス = 従の <section>` としてマトリクスを唯一の `<main>` から従属領域に格下げしている。ASCII 図（L34-36）も一致。軽微な残留不整合として、L32 のインライン注記 `(landmark: main > region "現在地")` が Now strip を `<main>` 内と示唆し、L55 の「下段全体のみが `<main>`」という記述と食い違う（Now strip が `<main>` の内か外かが曖昧）。優先順位という審査対象の要件は満たしているため非ブロッキングだが、refined-mockups で解消推奨。
- **Finding 3 — Fabricated citation: RESOLVED.** L185 は `intent-backlog.md: 「PU-09 は docs-bridge への統合により欠番」= 対応表の所有を PU-08 単一に集約、他は参照のみ` を引用。`intent-backlog.md` L19-20, L26 と照合し実在する記述であることを確認済み。「scope-definition c3」への言及はファイル内に残存しない。

Regression: `required-sections`（H2 多数）・`upstream-coverage`（intent-statement / scope-document / intent-backlog を本文で参照）とも健全。他の捏造・構造崩れは検出されず。

