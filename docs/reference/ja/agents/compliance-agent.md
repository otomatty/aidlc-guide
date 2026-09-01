# aidlc-compliance-agent — 技術リファレンス

## 識別情報

| 項目 | 値 |
|------|----|
| 名前 | aidlc-compliance-agent |
| ティア | **judgment** |
| 許可された Claude Code ツール | Read, Edit, Write, Glob, Grep, WebSearch, AskUserQuestion |
| 許可されていない Claude Code ツール | Task |

---

## 担当ステージ

### 主担当ステージ

このエージェントに主担当ステージはありません。ライフサイクル全体を通じて、
支援および助言の役割に専従します。

### 支援ステージ

| ステージ | 名称 | このエージェントの貢献内容 |
|----------|------|------------------------------|
| feasibility | 実現可能性と制約分析 | 規制上の制約の特定、コンプライアンス観点での実現可能性評価、RAID ログの初期化 |
| nfr-requirements | NFR 要件 | コンプライアンス主導の非機能要件と統制仕様 |
| infrastructure-design | インフラストラクチャ設計 | データ所在地の検証、暗号化要件、IAM 監査 |
| environment-provisioning | 環境プロビジョニング | プロビジョニング済み環境に対するコンプライアンス態勢の検証 |

---

## 連携パターン

### 受け取り元

| 提供元 | 成果物 |
|--------|--------|
| aidlc-architect-agent | コンプライアンスレビュー用のシステム設計、データフロー図 |
| aidlc-devsecops-agent | コンプライアンスマッピング用のセキュリティ統制、暗号化仕様 |

### 引き継ぎ先

| 引き継ぎ先 | 成果物 |
|----------|--------|
| aidlc-architect-agent | 設計へ組み込むためのコンプライアンス要件 |
| aidlc-devsecops-agent | 規制上の義務から導かれたセキュリティ統制仕様 |
| オーケストレーター | コンプライアンスリスクのエスカレーション、RAID ログ更新 |

### 協働相手（同位）

| 相手 | 共有する関心事項 |
|------|------------------|
| aidlc-aws-platform-agent | データ所在地、保管時暗号化、IAM 監査 |

---

## ナレッジソース

### 方法論（ティア 1）

パス: `.claude/knowledge/aidlc-compliance-agent/`

| ファイル | 内容 |
|----------|------|
| regulatory-frameworks.md | 主要な規制フレームワーク（PCI-DSS、HIPAA、SOC 2、GDPR）のリファレンス |

### チーム（ティア 2）

パス: `aidlc/knowledge/aidlc-compliance-agent/`（スペースレベルのナレッジディレクトリ。ユーザー管理）

チームが内容を持つときに作成するスペースレベルのディレクトリです（エンジンは `aidlc/knowledge/` を空で提供します）。既存のコンプライアンスマトリクス、監査所見、データ
分類スキーム、規制解釈など、プロジェクト固有のコンプライアンス文脈を
チームがここに格納します。

---

## 相互参照

- [エージェントリファレンス概要](README.md)
- [エージェントガイド: aidlc-compliance-agent](../../guide/agents/compliance-agent.md)
- [ステージドキュメント](https://github.com/awslabs/aidlc-workflows/blob/HEAD/docs/reference/04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-compliance-agent.md`](https://github.com/awslabs/aidlc-workflows/blob/HEAD/dist/claude/.claude/agents/aidlc-compliance-agent.md)
