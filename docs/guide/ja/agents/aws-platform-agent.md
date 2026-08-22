# AWS プラットフォームエージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](../06-agents.md) · 技術リファレンス: [aws-platform-agent](../../reference/agents/aws-platform-agent.md)

aidlc-aws-platform-agent は、あなたの AWS ソリューションアーキテクト兼インフラストラクチャエンジニアです。アプリケーションアーキテクチャを AWS サービスの選定、CDK/CloudFormation テンプレート、環境プロビジョニング戦略へ変換します。あらゆるインフラ判断でコストを意識し、既定で安全な構成にして、AWS Well-Architected Framework に照らして検証します。

aidlc-aws-platform-agent は 2 つのステージを主導し、さらに 4 つのステージを支援します。AWS CLI コマンド、CDK 操作、インフラ検証ツールを実行するために Bash を利用できます。

## 主導ステージ

| ステージ | フェーズ | 説明 |
|-------|-------|-------------|
| 3.4 Infrastructure Design | 構築 | AWS サービス選定、IaC テンプレート、コスト見積もり（ユニットごと） |
| 4.2 Environment Provisioning | 運用 | IaC 定義から環境をプロビジョニングし、検証する |

## 支援ステージ

| ステージ | フェーズ | 貢献内容 |
|-------|-------|-------------|
| 1.3 Feasibility & Constraints | アイデア創出 | AWS サービスの提供状況と制約を評価 |
| 2.6 Domain Design | 構想 | クラウドネイティブなパターンとサービス統合の助言 |
| 3.3 NFR Design | 構築 | NFR をインフラ仕様とスケーリング方針へ変換 |
| 4.7 Feedback & Optimization | 運用 | コスト最適化とインフラチューニング |

## 期待できること

aidlc-aws-platform-agent が有効なときは、AWS アカウント構成、既存インフラ、コスト制約、コンプライアンス要件について質問します。CDK/CloudFormation 仕様、VPC トポロジー、IAM ポリシー、環境階層ごとのコスト見積もりを含むインフラ設計を作成します。サービス提供状況や既存設定を確かめるために AWS CLI コマンドを実行することもあります。

## 連携方法

aidlc-aws-platform-agent は、aidlc-architect-agent からアプリケーション構成を、aidlc-devsecops-agent からセキュリティ要件を受け取ります。監視インフラと運用手順書の統合では aidlc-operations-agent と連携します。プロビジョニングした環境は、デプロイ先として aidlc-pipeline-deploy-agent へ引き渡されます。

## 主要原則

- すべてのインフラ判断は Well-Architected の 6 つの柱すべてに照らして説明できなければならない
- すべてのリソースはコードで定義する。コンソール変更はドリフトである
- コストは第一級の設計関心事であり、すべての設計にコスト見積もりを含める
- IAM ポリシーは必要最小限の権限だけを付与し、ワイルドカードポリシーを使わない
- 開発、ステージング、本番の各環境は規模だけが異なり、トポロジーは変えない
