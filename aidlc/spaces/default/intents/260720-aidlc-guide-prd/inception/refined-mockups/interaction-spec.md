# Interaction Specification — AIDLC Guide

> ステージ: refined-mockups (Inception 2.5) / 作成日: 2026-07-23
> 入力: mockups.md + user-flow.md + stories.md + requirements.md + team-practices.md
> 形式: component-spec-template に沿ったコンポーネント単位の仕様。Q1（自作軽量 + a11y 部品のみ Radix ヘッドレス）/ Q2（5状態）/ Q3（CSS トークン）を反映。

## コンポーネント一覧と調達（Q1-A）

| コンポーネント | 調達 | a11y プリミティブ |
|---------------|------|------------------|
| NowStrip / StatusChip / StatusLegend | 自作 | — |
| StageRail（一覧・矢印キー移動） | 自作 | roving tabindex（自作 or Radix Toolbar）|
| UnitStageMatrix / MatrixCell | 自作 | `<table>` セマンティクス |
| DetailPanel（右パネル・非モーダル） | 自作 + Radix FocusScope/DismissableLayer（Esc/フォーカス復帰、トラップ無し）| Radix FocusScope（trapped=false）+ DismissableLayer |
| StageCard / ArtifactViewer | 自作 + Milkdown | — |
| NextStepCallout（US-02/FR-4.6） | 自作 | — |
| AnswerEditor | 自作（contenteditable 制御） | — |
| IntentPicker | 自作 + Radix Select | Radix Select |
| ThemeToggle | 自作 | `aria-pressed` |
| ReadOnlyBadge / LiveStatus | 自作 | `role=status` / `aria-live` |

依存最小（team.md）: フル UI キットは入れず、フォーカス管理が難しい Dialog/Select/roving のみヘッドレスプリミティブを使う。

---

## コンポーネント仕様（抜粋・主要3件）

### C-1: NowStrip（US-01 / FR-4.1）
- **目的**: 現在地（phase/stage/unit/gate/完了数）を単体で読ませる。
- **Props**: `{ phase, stage, unit?, depth, gate: GateState, done, total }`
- **状態**: loading（スケルトン, `aria-busy`）/ success / error（gate 不明時 UnparseableBadge）。
- **インタラクション**: 静的表示。gate は StatusChip（色+記号+ラベル）。フォーカス順で最初（h2）。
- **AC 対応**: US-01（単体で現在地）。

### C-2: DetailPanel（US-03/13 / FR-4.2, FR-4.4, FR-6.1）— 非モーダル complementary
- **目的**: rail/matrix クリックで解説 or 成果物を右から開く。背後の Dashboard を操作可能に保つ（非モーダル）。
- **インタラクション**: 開: 右からスライドイン（`prefers-reduced-motion` 尊重、reduce 時は即時表示）。開いた瞬間フォーカスを h2 へ移す。Esc / [✕] で閉じ、フォーカスをトリガ要素へ復帰。**フォーカストラップは張らない**（背後を触れる non-modal なので `role=complementary`・`aria-modal` は付けない）。実装は Radix の **FocusScope（trapped=false, フォーカス移動+復帰のみ）+ DismissableLayer（Esc/外側クリックで閉じ）** を使い、Dialog の modal 挙動（トラップ+backdrop+`aria-modal`）は使わない — これで「非モーダル」と primitive 選択が整合する。
- **状態**: loading / empty(該当成果物なし) / error(Milkdown 崩れ→plain preview) / partial / success。
- **AC 対応**: US-03（4フィールド+deep-link）, US-13（WYSIWYG 5項目）。

### C-4: NextStepCallout（US-02 / FR-4.6）
- **目的**: **現在ステージ** の StageCard 内に、次の in-scope ステージ名＋そこで人間に求められることを示す（US-03 の自ステージ解説とは別区画・別データ源）。
- **Props**: `{ nextStage: string | null, nextRequirement: string }`（reader-core の next-stage 解決 = `aidlc_next_steps` と同じロジック）。`nextStage===null`（最終ステージ）は「次はワークフロー完了」を表示。
- **表示条件**: 親 StageCard が `aria-current=step` の現在ステージのときのみレンダリング。
- **インタラクション**: Now strip の現在ステージ→カードを開く（1クリック）で可視。「その解説を見る →」で次ステージの StageCard へ遷移。
- **状態**: success（次ステージ表示）/ end（最終ステージ→完了表示）。
- **AC 対応**: US-02 / FR-4.6（S-1 到達性の第二要素）。US-03（C-2/StageCard 本体）と区別。

### C-3: StageRail（US-16/18 / FR-4.2, FR-4.5）
- **目的**: ステージ列を辿る。SKIP 折りたたみ。
- **インタラクション**: ↑↓ で項目移動（roving tabindex, 1つだけ tabindex=0）、Enter で DetailPanel を開く。SKIP 群は `<details>`（既定閉、展開で理由）。現在ステージは `aria-current=step`。
- **状態**: 各項目 StatusChip（色+記号+ラベル、US-18）。
- **AC 対応**: US-16, US-18。

---

## 状態遷移（5状態モデル・Q2-A）

各データ駆動画面（Dashboard/Matrix/Viewer）:

```
[初期] → loading ──(reader成功)──→ success
                 ├─(intent無)────→ empty(M-4)
                 ├─(parse不能)───→ error(局所UnparseableBadge, 他は表示)  ← NFR-6/US-15
                 └─(部分欠落)────→ partial(該当セルのみ解析不可)
success/partial ──(fileChange watch)──→ 再fetch(楽観更新, スピナー無し) → 反映  ← NFR-3/US-20
```

- **loading**: 200ms 未満で解決するなら スケルトンを出さない（ちらつき防止）。
- **error/partial**: 局所縮退。全画面エラーにしない（NFR-6）。
- **リアルタイム（M-3）**: WebSocket push → 差分再描画。切断時は LiveStatus に「切断・再接続中」（`aria-live`）。

## マイクロインタラクション

- ステータス変化（例 ◐→✔）は色+記号の両方を同時に更新。`prefers-reduced-motion: reduce` ではトランジション無効。
- ホバー/フォーカスで StatusChip のラベルをツールチップ表示（フォーカスでも出す＝キーボード可達）。
- AnswerEditor 保存は明示ボタン（誤爆防止）。保存後、対象行以外がバイト不変であることをクライアントでも検証（US-14）。

## トレーサビリティ
各コンポーネント/遷移は stories.md の US と requirements.md の FR/NFR に対応。team-practices.md の「reader-core 一方向依存」を守り、コンポーネントは reader が返す型付きモデルを props で受けるのみ（UI 型を reader に持ち込まない）。
