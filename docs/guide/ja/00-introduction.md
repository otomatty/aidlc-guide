# イントロダクション

> [AI-DLC ドキュメント](https://github.com/awslabs/aidlc-workflows/blob/HEAD/docs/README.md) の一部 · **ユーザーガイド** · [ハーネスエンジニアガイド](https://github.com/awslabs/aidlc-workflows/blob/HEAD/docs/harness-engineering/00-overview.md) · [開発者リファレンス](../reference/00-overview.md)

## AI-DLC とは何ですか？

AI-DLC（AI-Driven Development Life Cycle）は、AI 支援ソフトウェア開発を反復可能で追跡可能なフェーズへ構造化するための方法論です。これは [AWS AI-DLC methodology](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) を起源としています。このリポジトリは、それをハーネス中立な単一のコアからネイティブに実装しているため、すでに使っている CLI ハーネスの中で動作します。現在は Claude Code、Kiro CLI、Kiro IDE、Codex CLI、Cursor、opencode、GitHub Copilot に対応しています。このガイド自体はハーネス中立です。ハーネスごとに異なる点がある場合は、その旨を明記し、対応する章へ案内します（[他のハーネスでの実行](harnesses/README.md) を参照）。特記がない限り、例は Claude Code で示します。

呼び出しは 1 つのコマンドで行います。

```
/aidlc Build a REST API for inventory management
```

すると AI-DLC は、意図の取り込みから要件、設計、実装、テスト、デプロイまでの構造化されたワークフローを案内しながら、あらゆる意思決定ポイントであなたが主導権を持てるようにします。

## 哲学: 少人数のモブ、幅広い能力を持つエージェント (Small Mob, Broad Agents)

数多くの細分化された専門家に分けるのではなく（これはウォーターフォールの引き継ぎ連鎖を再現してしまいます）、AI-DLC は **11 人の広く対応可能なエージェント** を使い、それぞれが複数のステージとフェーズにまたがって参加します。各エージェントはステージをまたいでコンテキストを保持するため、引き継ぎをなくし、調整コストを減らします。

これは、効果的な人間チームの働き方を模しています。3〜5 人の mob が機能全体をカバーし、それぞれが 1 つの狭い専門領域ではなく広いスキルを持ち寄る、という考え方です。

## オーケストレーターはどう動くのか

AI-DLC の中核では、単純なループが動いています。決定論的な **エンジン** が次に何をするかを決め、**コンダクター**（`/aidlc` セッション、`SKILL.md`）がそれを実行し、次の動きを再びエンジンに問い合わせます。このループ全体を通して、フレームワークは次を行います。

1. **ステージファイルを読む**。5 フェーズにまたがる 33 のステージ定義があり、それぞれに入力、手順、出力、主導エージェントが定義されています
2. **エージェントペルソナを読み込む**。ドメイン専門家の視点（アーキテクト、開発者、プロダクトマネージャーなど）と専用ナレッジを有効化します
3. **状態と監査を管理する**。`aidlc-state.md` で進行状況を追跡し、すべての意思決定をインテントの `audit/` シャードに記録して追跡可能にします
4. **ステージトポロジーに応じて委譲する**。集中的で自律的な作業やマルチエージェントコラボレーションのために、ハブアンドスポーク、パイプライン、またはモブとしてサブエージェントをディスパッチします
5. **承認ゲートを提示する**。各ステージの後に、あなたがレビューして承認してからワークフローが進みます

エンジンはルーティング（次のステージは何か、どのスコープか、いつ止まるか）を担い、コンダクターは実行品質（ステージを適切に進めること、良い質問をすること、意思決定をあなたに見える形にすること）を担います。ほとんどのステージは **インライン** で実行されます。つまりコンダクターがエージェントの視点を採用し、会話の中で直接あなたと作業します。ディスパッチ型トポロジーを使うのは 4 つのステージです。プラクティス発見とコード生成は `subagent` ハブとして、リバースエンジニアリングは 2 リンクの `pipeline` として、ユーザーストーリーは `mob` として実行されます。トポロジーの全体像は、インライン 29 / subagent 2 / pipeline 1 / mob 1 です。全体アーキテクチャについては、開発者リファレンスの [エンジンとスキルシステム](../reference/17-skill-system.md) を参照してください。

## このガイドの対象者

このガイドは、AI-DLC を **使って** ソフトウェアを構築する人のためのものです。

- **初めて使う方**: [はじめに](01-getting-started.md)、[ワークフロープロファイル](workflow-profiles.md)、[最初のワークフロー](02-your-first-workflow.md)、[スペースとインテント](03-spaces-and-intents.md) から始めてください
- **普段使っている方**: [CLI コマンド](12-cli-commands.md)、[スコープ、深度、テスト戦略](05-scopes-and-depth.md)、[トラブルシューティング](15-troubleshooting.md) を参照してください
- **チームリード**: AI-DLC をチーム基準に合わせるには [ナレッジ](08-knowledge.md) と [ルールと学習ループ](09-rules-and-the-learning-loop.md) を参照してください

AI-DLC の振る舞いを *どのように変えるか*、つまりステージやエージェントを追加し、スコープを定義し、ルールやセンサーを著述し、チームナレッジを追加したい場合は（すべて設定でありコード変更は不要です）、[ハーネスエンジニアガイド](https://github.com/awslabs/aidlc-workflows/blob/HEAD/docs/harness-engineering/00-overview.md) を参照してください。AI-DLC のコードベース自体を変更する場合は、[開発者リファレンス](../reference/00-overview.md) を参照してください。

## 主要な数字

| 指標 | 値 |
|--------|-------|
| フェーズ | 5（Initialization、Ideation、Inception、Construction、Operation） |
| ステージ | 33 |
| エージェント | 計 14。11 のドメイン専門家、2 のレビュアー、コンポーザー |
| スコープ | 11（enterprise から express まで、加えて workshop）+ 自動検出 |
| 深度レベル | 3（Minimal、Standard、Comprehensive） |
| テスト戦略レベル | 3（Minimal、Standard、Comprehensive） |
| 監査イベント種別 | 91 |

## ガイドマップ

| 章 | 学べること |
|---------|------------------|
| [はじめに](01-getting-started.md) | 前提条件、インストール、最初のヘルスチェック |
| [ワークフロープロファイル](workflow-profiles.md) | Classic、Express、その他のワークフロー選択肢の解説 |
| [最初のワークフロー](02-your-first-workflow.md) | 完全な実行例を注釈付きで追うウォークスルー |
| [スペースとインテント](03-spaces-and-intents.md) | ワークスペースレイアウト。スペースとインテントをまたいで複数の作業をどう進めるか |
| [フェーズとステージ](04-phases-and-stages.md) | 5 つのフェーズと 33 のステージの説明 |
| [スコープ、深度、テスト戦略](05-scopes-and-depth.md) | スコープ、深度、テスト戦略の選び方と上書き方法 |
| [エージェント](06-agents.md) | 14 エージェントの陣容。11 のドメイン専門家、2 のレビュアー、コンポーザー |
| [エージェント詳細](agents/README.md) | 各エージェントの参照ページ。責務、ステージ、ナレッジを掲載 |
| [対話モード](07-interaction-modes.md) | Guide Me / Edit File / Chat と承認ゲート |
| [ナレッジ](08-knowledge.md) | 会社標準の追加とチームドキュメントのカタログ化 |
| [ルールと学習ループ](09-rules-and-the-learning-loop.md) | 自己学習する行動ルール |
| [状態と監査](10-state-and-audit.md) | 進行状況と意思決定の追跡方法 |
| [セッション管理](11-session-management.md) | resume、redo、jump、復旧、セッション報告スキル |
| [CLI コマンド](12-cli-commands.md) | フラグ完全リファレンスと例 |
| [カスタマイズ](13-customization.md) | 設定、スコープ設定、エージェントのチューニング |
| [成果物リファレンス](14-artifacts-reference.md) | インテントごとの記録ディレクトリ（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）の説明 |
| [トラブルシューティング](15-troubleshooting.md) | 症状別の問題解決 |
| [実例](16-worked-examples.md) | bugfix と feature の完全な実例ウォークスルー |
| [スキルとランナーコマンド](17-skills.md) | `/aidlc-*` のステージ／スコープランナーコマンドと、自作ランナーを著述する道筋 |
| [複数チームでの Construction とワークショップモード](workshop-mode.md) | クローン型チームと兄弟ワークツリー型チームのためのクレーム・ビルド・ピン留めマージバック・リリース・ワークショップの流れ |
| [他のハーネスでの実行](harnesses/README.md) | Kiro CLI、Kiro IDE、Codex CLI、Cursor、opencode、GitHub Copilot でのインストールと実行方法、およびハーネスごとの差異 |
| [用語集](glossary.md) | すべての用語の定義 |
