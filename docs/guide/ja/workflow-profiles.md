# ワークフロープロファイル

AI-DLC は、すべてのタスクを同じライフサイクルに押し込めません。よくある作業の
種類に合わせた **ワークフロープロファイル** をひと揃い同梱しています。フル機能
開発、素早いバグ修正、インフラ変更、軽量な Express 実行、その他です。

エンジンはワークフロープロファイルを **スコープ** と呼びます。この 2 つの用語は、
同じ選択を異なる視点から言い表したものです。

- **ワークフロープロファイル** は利用者から見た体験です。どんな種類の作業をして
  いるのか、どれだけの手続きが必要なのかを表します。
- **スコープ** は `aidlc-state.md` に保存されるエンジンの設定です。そのワーク
  フローで使う正確なステージ経路、深度、テスト戦略、レビュー上限、手続きの切り替えを表します。

プロファイルは `/aidlc <profile>` で明示的に選ぶか、作業内容を説明して AI-DLC に
提案させます。キーワードの一致やコンポーズの提案は、開始前に経路を確認します。
明示的に名前を指定したプロファイルはすぐに開始され、そのステージ数とゲート数を
表示します。

## クイックチューザー

| ワークフロープロファイル | 向いている作業 | ステージ | 深度 | テスト戦略 | 開始コマンド |
|------------------|----------|--------|-------|---------------|------------|
| **Classic** | v1 型の Inception と Construction。Build and Test で完了 | 18 / 33 | Standard | Standard | `/aidlc classic` |
| **Express** | 要件からコードとテストまでの最も軽い経路 | 10 / 33 | Minimal | Minimal | `/aidlc express` |
| **Feature** | 完全なライフサイクルで作る本番機能 | 33 / 33 | Standard | Standard | `/aidlc feature` |
| **Enterprise** | 完全な追跡可能性を要する規制対象・高保証の作業 | 33 / 33 | Comprehensive | Comprehensive | `/aidlc enterprise` |
| **MVP** | 運用フェーズを含まない、実際の最初のプロダクト増分 | 23 / 33 | Standard | Standard | `/aidlc mvp` |
| **Proof of concept** | 最小限の実装経路で実現可能性を確かめる | 8 / 33 | Minimal | Minimal | `/aidlc poc` |
| **Bugfix** | 既知の不具合に対する的を絞った修正とリグレッションテスト | 9 / 33 | Minimal | Minimal | `/aidlc bugfix` |
| **Refactor** | プロダクトの挙動を変えずに既存コードを改善する | 10 / 33 | Minimal | Minimal | `/aidlc refactor` |
| **Infrastructure** | 環境、IaC、デプロイ基盤、コスト関連の作業 | 13 / 33 | Standard | Standard | `/aidlc infra` |
| **Security patch** | CVE 対応や範囲を絞った脆弱性対応 | 10 / 33 | Minimal | Minimal | `/aidlc security-patch` |
| **Workshop** | ファシリテーター主導のトレーニングや共同デリバリーのセッション | 26 / 33 | Standard | Minimal | `/aidlc workshop` |

ステージ数は静的な経路を表します。条件付きと記されたステージは、条件が当てはまら
なければ自らスキップされることがあります（グリーンフィールドのプロジェクトにおける
リバースエンジニアリングなど）。プロファイルごとの正確なステージ構成は
[ステージ×スコープ・マトリクス](05-scopes-and-depth.md#stage-by-scope-matrix)
を参照してください。

## `classic`

**Classic を選ぶとき:** 各ステージで人が一度承認し、v1 型の Inception と Construction を進めたい場合です。Ideation を省き、Operation は予約枠として残します。ステージで定義された実行モードとサポートエージェントは変わりません。

Classic は、利用者と `AWS_AIDLC_DEFAULT_SCOPE` のどちらも別のプロファイルを指定しない場合の暗黙の既定値です。対話で詳細なタスクを説明すると、作成前に適応コンポーズが提案される場合があります。成果物とテストは Standard です。Walking Skeleton とサマリー確認は無効、センサーと学びの手順は有効です。レビューは各ステージで助言を一度実行し、所見を承認ゲートに表示します。明示的な自律実行ではマージ前の一度のレビューを維持します。Guard Policyはrelaxedです。指示外の操作に対するPlan Approvalとreview-freezeのガードは下がり、通過ごとに `GUARD_STOOD_ASIDE` を記録します。コーディネーターによる必須承認の質問、人間のターン、監査、reviewer-scopeは維持します。

`/aidlc --sensors on|off`、`/aidlc --learnings on|off`、`/aidlc --summary-confirmation on|off` でインテント単位に変更できます。`AIDLC_DISABLE_SENSORS=1`、`AIDLC_DISABLE_LEARNINGS=1`、`AIDLC_DISABLE_SUMMARY_CONFIRMATION=1` は、インテントが on でも対応する手続きを無効にします。

問題自体がまだ不明確で、市場調査、実現可能性分析、明示的なスコープ探索が有効な
場合には Classic を選ばないでください。その場合は Feature か Enterprise を選びます。

## `express`

**Express を選ぶとき:** 要件がすでに理解されており、要件・実装・テスト、そして
任意のデプロイ末尾までを、サポートされている最短経路で通したい場合です。

Express はアイデア創出、設計パス、作業単位への分解、デリバリー計画、CI パイプライン
を省略します。ステージレビュアーのディスパッチを無効にし、Minimal の成果物と要件
駆動のテストを使います。リバースエンジニアリングとデプロイのステージは条件付きの
ままです。

曖昧な作業、チーム横断の作業、規制対象の作業、アーキテクチャ比重の高い作業では
Express を選ばないでください。その速さは、それらの判断面を意図的に取り除くことで
得られています。

Expressではsensors・learnings・summary confirmationをすべてoffにします。インテントごとに `/aidlc --sensors on|off`、`--learnings on|off`、`--summary-confirmation on|off` で上書きできます。

## `feature`

**Feature を選ぶとき:** 本番機能を作っており、完全なライフサイクルを実務的な深さで
回したい場合です。

Feature は 33 ステージすべてを Standard の深度で実行し、意図の発見から設計、実装、
デプロイ、フィードバックまでを通します。Enterprise ほど重い文書化の下限を課さずに、
未知のものを洗い出す機会を最も広く与えます。

## `enterprise`

**Enterprise を選ぶとき:** 規制対象、高リスク、監査が重視される作業、あるいは
形式的なコンプライアンスと運用上の証跡が必要な場合です。

Enterprise は 33 ステージすべてを Comprehensive の深度で実行します。市場、
コンプライアンス、セキュリティ、設計、オブザーバビリティ、インシデント対応、
パフォーマンスの作業を残します。文書化されていない判断のコストが、追加の手続きの
コストを上回るためです。

## `mvp`

**MVP を選ぶとき:** アイデアが可能かどうかを試すのではなく、実際の最初のプロダクト
増分を出荷する場合です。

MVP はインセプションとコンストラクションの設計・実装経路を Standard の深度で完全に
保ちます。アイデア創出の一部の手続きを削り、運用フェーズを省略します。プロダクトに
本番運用と完全なフィードバックのライフサイクルが必要になったら、Feature か
Enterprise へ移ってください。

## `poc`

**Proof of Concept を選ぶとき:** 主たる問いが「そのアプローチが成り立つか」である
場合です。

PoC は 8 ステージを Minimal の深度で使います。プロダクト、設計、運用の手続きの多くを
省き、要件・コード・テストへ素早く到達します。PoC は後の判断のための証拠であり、
本番対応可否を判断するプロファイルではありません。

## `bugfix`

**Bugfix を選ぶとき:** 不具合が特定されており、望む結果が検証を伴う的を絞った修正で
ある場合です。

Bugfix は 9 ステージを Minimal の深度で使います。ワークスペースの理解、要件、
コード生成、ビルドとテスト、そしてデプロイの経路は残し、発見、広範な設計、無関係な
運用の作業は落とします。

## `refactor`

**Refactor を選ぶとき:** 挙動は安定させたまま、内部構造、保守性、技術的負債を改善
する場合です。

Refactor は 10 ステージを Minimal の深度で使います。既存コードの理解、内部変更の
定義、その実装、挙動が退行していないことの証明、そして検証済みの結果をデプロイまで
運ぶことを重視します。利用者から見える挙動が変わる作業なら、代わりに Feature を
使ってください。

## `infra`

**Infrastructure を選ぶとき:** 成果物が環境、IaC の変更、デプロイ基盤、プラット
フォーム機能、コスト最適化である場合です。

Infrastructure は 13 ステージを Standard の深度で使います。利用者向けプロダクトの
手続きを取り除き、要件、非機能要件、インフラ設計、CI/CD、デプロイ、オブザーバビリティ
に集中します。

## `security-patch`

**Security Patch を選ぶとき:** 既知の CVE、脆弱性、範囲の狭いセキュリティ不具合へ
対応する場合です。

Security Patch は 10 ステージを Minimal の深度で使います。セキュリティに関わる要件、
検証、実装、デプロイの経路を保ちつつ、無関係なプロダクトの手続きを避けます。的を
絞ったパッチではなく、より広いセキュリティ／コンプライアンスのプログラムであれば
Enterprise を使ってください。

## `workshop`

**Workshop を選ぶとき:** ファシリテーターがトレーニングラボや調整された共同セッション
を主導する場合です。

Workshop は、演習をファシリテーターが用意するためアイデア創出を省略し、その後は
インセプションから運用までのライフサイクルを Standard の深度で実行します。教育の
セッションを止めないよう、テスト戦略は意図的に Minimal を使い、通常のレビューは
助言 1 回に制限します。複数参加者での進め方は [ワークショップモード](workshop-mode.md)
にあります。

## AI-DLC に選ばせる・コンポーズさせる

プロファイルを覚える必要はありません。作業内容を説明してください。

```
/aidlc Fix the login timeout bug
/aidlc Build a regulated payment approval service
/aidlc Create a lightweight prototype for the new search flow
```

キーワードが明確に一致すれば、標準プロファイルを提案し、そのステージ数とゲート数を
確認用に表示します。内容が濃い作業や曖昧な作業では、適応コンポーザーを使う提案が
出ます。コンポーザーはあつらえのステージ経路を提案し、作成前に承認を待ちます。

次のようにしてその経路を強制できます。

```
/aidlc compose "harden the deployment pipeline and add observability"
```

## Constructionの承認と実行

Unit分解とソース生成を含む新規ソロ作業は、Unitごとの直列実行と検証済み完了チェックポイントを使います。Unit分解を省くExpress、設計のみの作業、既存ワークフロー、チーム所有Unit、明示的に選んだ順序は従来の進行を維持します。

skeleton-onでは最初の統合Unitを実装・検証して人間が承認し、後続Unitへ進みます。自律方針が未設定の場合、skeleton-offではConstruction開始時、skeleton-onではスケルトン承認後にContinue automatically / Review each checkpointを選びます。後から許可・取消もできます。

並列実行はstage-majorとswarmを明示的に選びます。承認方針とは別の選択です。各UnitのPlan Approval、検証コマンド選択、有効な要約確認、失敗時の判断は人間が行います。複数計画をApprove Plansでまとめて提示する場合も個別記録が必要です。人間が許可した同じ検証コマンドをUnit／バッチごとに再利用し、変更には新たな許可を得ます。詳細は[Construction](04-phases-and-stages.md#フェーズ-3-コンストラクション-construction)を参照してください。

## 関連する制御

ワークフロープロファイルは経路と既定値を決めます。次の項目は独立して調整できます。

- **深度**: `--depth minimal|standard|comprehensive`。
- **テスト戦略**: `--test-strategy minimal|standard|comprehensive`。
- **レビュー上限**: `--review adversarial|advisory|none`。実効クラスは、ステージの
  宣言、プロファイルの上限、この実行単位の上限のうち最も低いものになるため、
  レビューの強度を引き上げることはできません。

これらの上書きは、あるプロファイルを別のプロファイルに変えるものではなく、選択した
プロファイルを調整するものです。規範的なルーティング表と上書きの意味論は
[スコープ、深度、テスト戦略](05-scopes-and-depth.md) を参照してください。
