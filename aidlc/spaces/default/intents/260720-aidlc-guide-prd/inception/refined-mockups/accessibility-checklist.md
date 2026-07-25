# Accessibility Checklist — AIDLC Guide

> ステージ: refined-mockups (Inception 2.5) / 作成日: 2026-07-23
> 入力: mockups.md + interaction-spec.md + design-system-mapping.md + wireframes.md / user-flow.md（rough-mockups）+ stories.md + requirements.md + team-practices.md
> 基準: WCAG 2.1 AA（rough Q4 / design-agent 既定）。project.md「色+記号+ラベル三重表現」を全サーフェスで担保。各項目は検証可能（自動 or 手動）。
> 上流根拠: wireframes.md の各画面 a11y note（S-1/S-2/S-3/S-4 の landmark・キーボード導線）を検証項目に昇格。stories.md の US-18（色非依存）・US-11（read-only）・US-15（fail-soft）・US-02（次ステップ）を直接トレース。user-flow.md のフロー1（初学者の現在地理解）がキーボードのみで完走できることを手動走査の対象とする。

## 1. 知覚可能（Perceivable）

- [ ] **色非依存（1.4.1）**: 全状態が色 + 記号（✔◐◔○⊘⚠）+ テキストラベルの三重（US-18）。グレースケール化テストで状態判別可能。**自動**（記号/ラベル要素の存在をコンポーネントテスト）+ 手動。
- [ ] **コントラスト（1.4.3/1.4.11）**: テキスト 4.5:1、非テキスト（状態色・罫線・フォーカスリング）3:1、ライト/ダーク双方（design-system-mapping トークン）。**自動**（トークン値のコントラスト計算をローカルゲートで）。
- [ ] **テキストリサイズ（1.4.4）**: 200% 拡大で情報欠落・横スクロール破綻なし（rem/相対単位）。手動。
- [ ] **リフロー（1.4.10）**: 1280px 基準。matrix 等の広い要素は自身の `overflow-x:auto` でスクロールし body は横スクロールしない。手動。

## 2. 操作可能（Operable）

- [ ] **キーボード操作（2.1.1）**: 全機能がキーボードで到達・実行可能。rail=矢印+Enter、matrix=矢印、DetailPanel=Esc、IntentPicker/ThemeToggle=標準。**手動**（キーボードのみ操作走査）。
- [ ] **キーボードトラップ回避（2.1.2）**: DetailPanel は**非モーダル**（Radix FocusScope trapped=false + DismissableLayer）でフォーカストラップを張らず、Esc/外側クリックで閉じてフォーカスをトリガへ復帰する（背後の Dashboard も操作可能）。**自動**（RTL でフォーカス復帰＋トラップ不在を検証）。
- [ ] **フォーカス順序（2.4.3）**: banner → NowStrip → StageRail → Matrix → DetailPanel（開時）。Now strip→rail→matrix のプロミネンス順（US-01/FR-4.1）。手動。
- [ ] **フォーカス可視（2.4.7）**: 全 interactive 要素に可視フォーカスリング（3:1）。**自動**（フォーカス時スタイル存在）。
- [ ] **モーション（2.3.3）**: `prefers-reduced-motion: reduce` でパネルスライド/トランジション無効（interaction-spec）。**自動**（メディアクエリ分岐の存在）。

## 3. 理解可能（Understandable）

- [ ] **言語（3.1.1）**: `<html lang>` を設定。自動。
- [ ] **一貫したナビ（3.2.3）**: rail/Now strip の位置・意味が全画面で一貫（参加者ビューも同一レイアウト）。手動。
- [ ] **平易な解説（US-03）**: StageCard は4フィールド + 用語カードリンク（主観語をACから排除済み）。**自動**（4フィールド存在 + deep-link 解決）。
- [ ] **次ステップ導線（US-02/FR-4.6）**: 現在ステージの StageCard に NextStepCallout（次ステージ名 + 求められること）が存在し、キーボードで到達・「その解説を見る」リンクが操作可能。US-03 の自ステージ解説とは別区画。**自動**（現在ステージカードに NextStepCallout 要素が存在し次ステージ名を表示）。

## 4. 堅牢（Robust）

- [ ] **名前・役割・値（4.1.2）**: landmark（banner/nav/main/complementary）、`aria-current=step`（現在ステージ）、`role=status`（ReadOnlyBadge/UnparseableBadge/LiveStatus）、`aria-busy`（loading）、`aria-live=polite`（Mob push/切断）。**自動**（アクセシビリティツリー検査）。
- [ ] **状態通知（4.1.3）**: 空/解析不可は `role=alert`（初回）、リアルタイム更新は `aria-live=polite`（US-10/15）。**自動**。

## 5. サーフェス別の要点

| サーフェス | 要点 |
|-----------|------|
| Dashboard(M-1) | landmark 構造、rail の roving tabindex、matrix は `<table>`＋th |
| DetailPanel(M-2) | 非モーダル complementary（FocusScope trapped=false + DismissableLayer）、開時に h2 へフォーカス移動・Esc で復帰（トラップ無し・`aria-modal` 無し）、read-only 領域 `aria-readonly`、AnswerEditor のみ編集可+ラベル |
| 参加者ビュー(M-3) | ReadOnlyBadge `role=status`、更新 `aria-live`、編集UIは DOM 不在（US-11） |
| 空/解析不可(M-4) | EmptyState h2 + `role=alert`、IntentPicker が最初のフォーカス可能要素 |

## 検証方法

- **自動**: RTL + jest-axe 相当（Vitest + @testing-library/react、team.md のテスト方針）でロール/ラベル/フォーカスを検証。トークンのコントラストはローカルゲートで計算チェック。
- **手動**: キーボードのみ走査、スクリーンリーダー（VoiceOver/NVDA）スポット、グレースケール表示、200% 拡大。M3（WYSIWYG）の視覚チェックリストと同じタイミングで実施。

## トレーサビリティ
本チェックリストは requirements.md の NFR（アクセシビリティは FR-4.2/US-18 経由）と rough-mockups の各画面 a11y note を統合し、team-practices.md の三重表現規約を検証項目に落としたもの。
