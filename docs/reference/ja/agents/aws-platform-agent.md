# aidlc-aws-platform-agent — 技術リファレンス

## 識別情報

| 項目 | 値 |
|------|----|
| 名前 | aidlc-aws-platform-agent |
| ティア | **judgment** |
| 許可された Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 許可されていない Claude Code ツール | Task |

---

## 担当ステージ

### 主担当ステージ

| ステージ | 名称 | このエージェントの役割 |
|----------|------|------------------------|
| infrastructure-design | インフラストラクチャ設計 | アプリケーションアーキテクチャを、AWS サービスの選定、CDK/CloudFormation テンプレート、VPC 設計、IAM ポリシー、コスト見積もりへと落とし込みます |
| environment-provisioning | 環境プロビジョニング | ドリフト検出と環境同等性を備えた IaC 定義から、dev/staging/production 環境をプロビジョニングします |

### 支援ステージ

| ステージ | 名称 | このエージェントの貢献内容 |
|----------|------|------------------------------|
| feasibility | 実現可能性と制約分析 | AWS サービスの提供状況、リージョン制約、クラウドプラットフォームの制限を評価します |
| domain-design | ドメイン設計 | クラウドネイティブパターン、マネージドサービス統合、サーバーレスの選択肢について助言します |
| nfr-design | NFR 設計 | NFR をインフラ仕様、自動スケーリングポリシー、レジリエンス構成へと変換します |
| feedback-optimization | フィードバックと最適化 | 本番メトリクスに基づいて、コスト最適化の機会とインフラのチューニング項目を特定します |

---

## 連携パターン

### 受け取り元

| 提供元 | 成果物 |
|--------|--------|
| aidlc-architect-agent | アプリケーショントポロジー、コンポーネント一覧、インフラ要件 |
| aidlc-devsecops-agent | セキュリティ要件、コンプライアンス統制、暗号化仕様 |

### 引き継ぎ先

| 引き継ぎ先 | 成果物 |
|----------|--------|
| aidlc-pipeline-deploy-agent | デプロイ先向けの環境エンドポイント、インフラ出力 |
| aidlc-operations-agent | オブザーバビリティ設定と監視のためにプロビジョニング済みのインフラ |

---

## ナレッジソース

### 方法論（ティア 1）

パス: `.claude/knowledge/aidlc-aws-platform-agent/`

| ファイル | 内容 |
|----------|------|
| cdk-best-practices.md | AWS CDK のコンストラクトパターン、スタック構成、テスト |
| cost-optimization-patterns.md | FinOps パターン、ライトサイジング、リザーブドインスタンス、Savings Plans |
| infrastructure-guide.md | インフラ設計手法と環境プロビジョニング |
| well-architected-framework.md | AWS Well-Architected Framework の 6 つの柱のリファレンス |

### チーム（ティア 2）

パス: `aidlc/knowledge/aidlc-aws-platform-agent/`（スペースレベルのナレッジディレクトリ。ユーザー管理）

チームが内容を持つときに作成するスペースレベルのディレクトリです（エンジンは `aidlc/knowledge/` を空で提供します）。既存の VPC 設計、AWS アカウント構成、
承認済みサービスカタログ、コストベースラインなど、プロジェクト固有の
インフラ文脈をチームがここに格納します。

---

## 相互参照

- [エージェントリファレンス概要](README.md)
- [エージェントガイド: aidlc-aws-platform-agent](../../guide/agents/aws-platform-agent.md)
- [ステージドキュメント](https://github.com/awslabs/aidlc-workflows/blob/main/docs/reference/04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-aws-platform-agent.md`](https://github.com/awslabs/aidlc-workflows/blob/main/dist/claude/.claude/agents/aidlc-aws-platform-agent.md)
