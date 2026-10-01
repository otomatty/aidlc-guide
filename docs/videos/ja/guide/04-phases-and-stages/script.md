# 台本：フェーズとステージ

- 対象ページ：`docs/guide/en/04-phases-and-stages.md`（用語は `docs/guide/ja/04-phases-and-stages.md` に合わせる）
- 状態：**検証用サンプル（下書き）**。ナレーションは未作成。`bun run video voice` で Grok TTS から作る
- 字幕と映像の正は `storyboard.json`。この台本はレビュー用の読みやすい形

## はじめに

- この動画では、AI-DLC の全体の流れを見ていきます。
- 作業は 5 つのフェーズに分かれ、その中に 33 のステージがあります。

## フェーズは順番に進む

- フェーズは、初期化から運用まで順番に進みます。
- フェーズの境目では検証ゲートが、成果物のつながりに抜けがないかを確かめます。
- 運用で得たことは、次のアイデア創出へフィードバックされます。

## フェーズ 0：初期化

- 最初の初期化では、作業場所と状態ファイルを用意します。
- 3 つのステージは自動で進み、承認を求められることはありません。

## アイデア創出とインセプション

- アイデア創出では、意図をとらえて範囲を決め、進めてよいかの承認を得ます。
- インセプションでは、要件を整理して設計し、作業の単位と順番を決めます。

## コンストラクションと運用

- コンストラクションでは、Unit ごとに設計、実装、テストを進めます。
- 運用では、デプロイと監視を整え、改善のサイクルを回します。

## まとめ

- ほとんどのステージは、最後に人の承認を受けてから次へ進みます。
- まずは今いるフェーズを確かめ、次に何が求められるかを本文で確認しましょう。

## 原文との対応

| 台本の主張 | 原文 |
| --- | --- |
| 5 フェーズ・33 ステージ | 冒頭「organized into 5 phases containing 33 stages」 |
| 境目で検証ゲート | Lifecycle Overview「At each phase boundary (except Initialization → Ideation), a verification gate runs」 |
| 運用からフィードバック | Lifecycle Overview の Feedback Loop（4.7 → 1.1） |
| 初期化は自動・承認なし | Phase 0「run automatically without approval gates」 |
| ステージ数（7・9・7・7） | 各フェーズのステージ表 |
| コンストラクションは Unit ごと | Phase 3「3.1–3.5 per Unit」 |
| ほとんどのステージは承認で進む | Stage Execution Modes「Inline: 29 stages … approval gate at end」 |
