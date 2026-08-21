# aidlc-design-agent — 技術リファレンス

## 識別情報

| 項目 | 値 |
|------|----|
| 名前 | aidlc-design-agent |
| ティア | **judgment** |
| 許可された Claude Code ツール | Read, Edit, Write, Glob, Grep, WebSearch, AskUserQuestion |
| 許可されていない Claude Code ツール | Task |

---

## 担当ステージ

### 主担当ステージ

| ステージ | 名称 | このエージェントの役割 |
|-------|------|------------------------|
| rough-mockups | ラフモックアップとコンセプト可視化 | アイデア創出の間に、低忠実度のワイヤーフレーム、コンセプトスケッチ、初期情報アーキテクチャを作成する |
| refined-mockups | 洗練されたモックアップと UX 設計 | ワイヤーフレームを、インタラクション仕様、レスポンシブ設計、アクセシビリティ注記を備えた中〜高忠実度のモックアップへ発展させる |

### 支援ステージ

| ステージ | 名称 | このエージェントの貢献内容 |
|-------|------|------------------------------|
| user-stories | ユーザーストーリー | ストーリーにインタラクションの詳細と UX の受け入れ基準を追加する |
| domain-design | ドメイン設計 | UI コンポーネント仕様とデザインシステム対応付けに貢献する |

---

## 連携パターン

### 受け取り元

| 提供元 | 成果物 |
|--------|--------|
| aidlc-product-agent | ユーザーストーリー、ペルソナ、意図、ユーザージャーニーの文脈 |
| aidlc-architect-agent | コンポーネント設計上の制約、UI に影響する技術的制限 |

### 引き継ぎ先

| 引き継ぎ先 | 成果物 |
|------------|--------|
| aidlc-developer-agent | 実装向けのインタラクション仕様、コンポーネント仕様 |
| aidlc-quality-agent | テスト向けの UX 受け入れ基準、アクセシビリティ要件 |

---

## ナレッジソース

### 方法論（ティア 1）

パス: `.claude/knowledge/aidlc-design-agent/`

| ファイル | 内容 |
|----------|------|
| accessibility-wcag.md | WCAG 2.1 AA ガイドラインと実装パターン |
| component-spec-template.md | コンポーネント仕様（状態、プロパティ、ふるまい）を文書化するためのテンプレート |
| interaction-design-patterns.md | ナビゲーション、フォーム、フィードバック、状態遷移のインタラクションパターン |
| ux-guide.md | UX 設計の方法論と原則 |
| wireframing-guide.md | 低忠実度・高忠実度のワイヤーフレーム作成手法 |

### チーム（ティア 2）

パス: `aidlc/knowledge/aidlc-design-agent/`（スペースレベルのナレッジディレクトリ。ユーザー管理）

チームがコンテンツを持つ場合に作成するスペースレベルのディレクトリです（エンジンは `aidlc/knowledge/` を空のまま提供します）。既存のデザインシステム、ブランドガイドライン、タイポグラフィ規則、
コンポーネントライブラリなど、プロジェクト固有のデザイン資産をチームが格納します。

---

## 相互参照

- [エージェントリファレンス概要](README.md)
- [エージェントガイド: aidlc-design-agent](../../guide/agents/design-agent.md)
- [ステージドキュメント](https://github.com/awslabs/aidlc-workflows/blob/main/docs/reference/04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-design-agent.md`](https://github.com/awslabs/aidlc-workflows/blob/main/dist/claude/.claude/agents/aidlc-design-agent.md)
