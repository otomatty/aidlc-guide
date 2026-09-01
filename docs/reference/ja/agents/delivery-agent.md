# aidlc-delivery-agent — 技術リファレンス

## 識別情報

| 項目 | 値 |
|------|----|
| 名前 | aidlc-delivery-agent |
| ティア | **templated** |
| 許可された Claude Code ツール | Read, Edit, Write, Glob, Grep, AskUserQuestion |
| 許可されていない Claude Code ツール | Task |

---

## 担当ステージ

### 主担当ステージ

| ステージ | 名称 | このエージェントの役割 |
|-------|------|------------------------|
| team-formation | チーム編成 | 必要なスキルセットを評価し、モブチームを編成し、コミュニケーション規範を定義する |
| approval-handoff | イニシアチブ承認と引き継ぎ | イニシアチブ概要を取りまとめ、完全性を検証し、ステークホルダー承認に提示し、フェーズ引き継ぎを実行する |
| delivery-planning | デリバリ計画 | Bolt のシーケンスを計画し（units-generation ステージの依存 DAG を踏まえた経済的な順序付け）、モブを割り当て、Bolt ごとの完了の定義（DoD）と信頼仮説を定義する |

### 支援ステージ

| ステージ | 名称 | このエージェントの貢献内容 |
|-------|------|------------------------------|
| scope-definition | スコープ定義と優先順位付け | スコープがデリバリ実現可能性と利用可能なキャパシティに見合っているかを検証する |
| units-generation | ユニット生成 | ユニットの粒度を計画ニーズとデリバリ順序付け要件に合わせる |

---

## 連携パターン

### 受け取り元

| 提供元 | 成果物 |
|--------|--------|
| aidlc-product-agent | スコープ、優先順位、イニシアチブのフレーミング、優先順位付きバックログ |
| aidlc-architect-agent | ユニット、複雑度見積もり、依存グラフ |

### 引き継ぎ先

| 引き継ぎ先 | 成果物 |
|------------|--------|
| 構築フェーズの全エージェント | デリバリ計画、モブ割り当て、Bolt シーケンス |
| オーケストレーター | フェーズゲート承認向けのイニシアチブ概要 |

---

## ナレッジソース

### 方法論（ティア 1）

パス: `.claude/knowledge/aidlc-delivery-agent/`

| ファイル | 内容 |
|----------|------|
| mob-programming-guide.md | モブプログラミングのパターン、役割（ドライバー、ナビゲーター、リサーチャー）、チーム構成 |
| team-topologies.md | チーム編成パターンとコミュニケーション構造 |
| workflow-planning-guide.md | デリバリ計画: 経済的順序付け対トポロジカル順序付け、WSJF、ウォーキングスケルトン、Bolt DoD パターン |

### チーム（ティア 2）

パス: `aidlc/knowledge/aidlc-delivery-agent/`（スペースレベルのナレッジディレクトリ。ユーザー管理）

チームがコンテンツを持つ場合に作成するスペースレベルのディレクトリです（エンジンは `aidlc/knowledge/` を空のまま提供します）。チーム規約、Bolt サイズ設定の好み、
組織上のキャパシティ制約など、プロジェクト固有のデリバリ文脈をチームが格納します。

---

## 相互参照

- [エージェントリファレンス概要](README.md)
- [エージェントガイド: aidlc-delivery-agent](../../guide/agents/delivery-agent.md)
- [ステージドキュメント](https://github.com/awslabs/aidlc-workflows/blob/HEAD/docs/reference/04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-delivery-agent.md`](https://github.com/awslabs/aidlc-workflows/blob/HEAD/dist/claude/.claude/agents/aidlc-delivery-agent.md)
