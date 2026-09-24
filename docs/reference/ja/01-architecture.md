# アーキテクチャ

> **出典**: エンジンとコンダクター（`.claude/tools/aidlc-orchestrate.ts` と `.claude/skills/aidlc/SKILL.md`）およびその周辺ファイルから導出。

## 概要

AI-DLC はハイブリッド実行モデルを採用します。いくつかのステージはインラインで実行され（コンダクターがエージェントペルソナを読み込み、会話内で直接実行する）、別のステージは Claude Code のタスクツール経由でサブエージェントへ委譲されます。インラインステージはユーザーとの対話（質問、確認、承認）を支えます。サブエージェントステージは自律的に実行され、構造化サマリーを返します。

```mermaid
graph LR
    subgraph INITIALIZATION["初期化 (0.1-0.3)"]
        Z1["ワークスペーススキャフォールド"]
        Z4["状態初期化"]
        Z1 -.->|"3 ステージ"| Z4
    end

    subgraph IDEATION["アイデエーション (1.1-1.7)"]
        I1["インテント取得"]
        I7["承認とハンドオフ"]
        I1 -.->|"7 ステージ"| I7
    end

    subgraph INCEPTION["インセプション (2.1-2.9)"]
        N1["リバースエンジニアリング"]
        N7["デリバリープランニング"]
        N1 -.->|"9 ステージ"| N7
    end

    subgraph CONSTRUCTION["コンストラクション (3.1-3.7)"]
        C1["機能設計"]
        C7["CI パイプライン"]
        C1 -.->|"ユニットごとに 7 ステージ"| C7
    end

    subgraph OPERATION["オペレーション (4.1-4.7)"]
        O1["デプロイメントパイプライン"]
        O7["フィードバックと最適化"]
        O1 -.->|"7 ステージ"| O7
    end

    Z4 -->|"自動進行"| I1
    I7 -->|"検証ゲート 1"| N1
    N7 -->|"検証ゲート 2"| C1
    C7 -->|"検証ゲート 3"| O1
    O7 -.->|"フィードバックループ"| I1

    style INITIALIZATION fill:#f3e5f5,stroke:#9c27b0,color:#000
    style IDEATION fill:#e8f5e9,stroke:#4caf50,color:#000
    style INCEPTION fill:#e3f2fd,stroke:#2196f3,color:#000
    style CONSTRUCTION fill:#fff3e0,stroke:#ff9800,color:#000
    style OPERATION fill:#fce4ec,stroke:#e91e63,color:#000
```

## 5 層

**ルール**（`rules/`） -- 組織とプロジェクトのガードレールです。自己学習型であり、人間の修正は永続的な振る舞いルールになります。合計およそ 35 行だけに抑えられており、AI-DLC 以外の会話でコンテキストが膨らむのを避けています。

**エージェント**（`agents/*.md`） -- 14 個のフラットなエージェントファイルです。11 のドメイン専門家ペルソナ、2 つのレビュー専用エージェント、そして適応ワークフローのコンポーザーからなります。各ファイルがロール、責務、コラボレーションパターン、ツール、関連するメモリの焦点を定義します。著述されたコアのペルソナは `disallowedTools: Task` を持ちます。パッケージャーは、対応しているハーネスではそのネイティブな拒否をそのまま保ち、対応していないハーネスには「入れ子の委譲を許さない」という同じ境界をそのハーネスのツールポリシーへ投影します。Kiro のエージェント Markdown はこの未対応キーを省略し、Kiro CLI のエージェント JSON と Kiro IDE の `tools:` 許可では、委譲先から `subagent` ツールを除外します。

**ナレッジ**（`knowledge/`） -- 2 層の方法論リファレンスです。
- `aidlc-shared/` -- 原則、検証、ブラウンフィールド保護策、**監査イベント分類体系**（正準イベントレジストリ）、状態テンプレート
- `aidlc-<agent>-agent/` -- エージェントごとの方法論ファイル（アーキテクチャパターン、テスト戦略など）

**スキル**（`skills/aidlc/`） -- オーケストレーターのエントリポイント（`SKILL.md`）、静的／回復／ガバナンスの各プロトコルファイルに加えて `aidlc-common/protocols/` 配下の条件付きで読み込まれるレビュアー／アンサンブル／構築／スウォームの 4 モジュール、そして 5 つのフェーズディレクトリ（`stages/initialization/`, `stages/ideation/`, `stages/inception/`, `stages/construction/`, `stages/operation/`）にまたがる 33 個のステージファイルです。

**フック**（`hooks/`） -- 監査出力（書き込み・編集後のツール使用時）、セッションライフサイクル（開始・終了）、状態同期（タスク更新後のツール使用時）、状態検証（圧縮前）、サブエージェント追跡（停止時）、ステータスライン描画のためのフレームワークフックです。フレームワークファイルはすべて `aidlc-*.ts` という接頭辞を持ちます。

## 設定レイヤー

> **対象読者**: 新しい関心事（ルール、方法論の一片、センサー束縛、ドメインナレッジの事実）をどこへ置くべきか判断するコントリビューター。
> **正本としての位置付け**: これはルーティング原理です。コードとこの節が食い違う場合は、この節が正であり、コードの分類が誤っています。

このリポジトリの設定は、1 つではなく**2 つの直交軸**に沿って分割されます。

### 軸 1 -- 誰が著述するか?

- **フレームワーク著述** -- AI-DLC 配布物に同梱されます。すべてのプロジェクトで内容は同じです。フレームワークのリリース時に更新されます。ユーザーが自分のワークスペースで編集することはありません。
- **チーム著述** -- 人間が書くものです（または、このワークスペースで動くステージが書き、その後に人間が確認したもの）。このプロジェクト固有であり、このワークスペース内ではワークフローをまたいで永続します。編集可能です。

### 軸 2 -- いつ消費されるか?

- **継続的に読み込まれる（ハーネス設定）** -- セッション開始時に読まれ、このワークスペースで走るあらゆるワークフローのすべてのステージで利用可能です。`.claude/` 配下にあります。
- **ワークフロー単位の成果物** -- 特定ステージが出力として生成し、後続ステージが入力として読むものです。インテントの記録ディレクトリ（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`。以下では `<record>/` と表記）に置かれます。ワークフローの実行ごとに再生成されます。

### 4 つの象限

2 つの軸を掛け合わせると 4 つの象限になります。3 つは使われ、1 つは意図的に空です。

|  | フレームワーク著述 | チーム著述 |
|---|---|---|
| **継続的に読み込まれる**（ハーネス設定） | `.claude/skills/`, `.claude/agents/`, `.claude/knowledge/`, `aidlc/spaces/<active-space>/memory/org.md`, `aidlc/spaces/<active-space>/memory/phases/*.md`, `.claude/scopes/`, `.claude/tools/data/scope-grid.json`, `.claude/tools/data/stage-graph.json` | `aidlc/spaces/<active-space>/memory/team.md`, `aidlc/spaces/<active-space>/memory/project.md` |
| **ワークフロー単位の成果物** | *(設計上空)* | `<record>/aidlc-state.md`, `<record>/audit/*.md`（クローンごとの分割記録）, `<record>/<phase>/<stage>/*.md`, `.aidlc/worktrees/bolt-<id8>_<slug>/` |

フレームワークはワークフロー単位の成果物を生成しません。そうした出力は配布物とともに出荷しなければならず、その時点でそれはワークフロー出力ではなくフレームワーク著述のハーネス設定になるからです。この空セルは欠落ではなく、ルーティング規則の特徴です。

> **フレームワーク著述 = 上流から届くもの。プロジェクト内では不変として扱います。** これはバージョン管理やファイルシステムで強制されるわけではありません。`.claude/` は編集可能な領域であり、`org.md` や `phases/*.md` をその気になれば編集できます。ただし慣例は、フレームワーク既定値を直接書き換えるのではなく、`team.md` / `project.md`（右側のセル）で上書きすることです。そうすればレビュー時にオーバーライドが可視化され、フレームワークのアップグレードもきれいに通り、同じフレームワークバージョンを共有する複数プロジェクト間のドリフトも防げます。

### 新しい関心事を配置するための境界テスト

新しい関心事が来たとき、配置先は次の 2 つの問いで決まります。

1. **すべてのプロジェクトで同じ内容か、それともプロジェクト固有か?** フレームワーク著述かチーム著述か。
2. **毎セッション、エージェントコンテキストへ読み込まれるか、それとも特定ステージだけが読むか?** ハーネス設定かワークフロー単位の成果物か。

具体例:

- *「常に既定ブランチへスカッシュマージする」* -- プロジェクト固有です（ほかのチームはリベースを使う）し、継続的に読み込まれます（コンダクターは毎回のボルトマージでそれを読みます）。置き場所は `aidlc/spaces/<active-space>/memory/team.md` です。
- *「サービスレイヤーでは常に成功値またはエラー値を返し、例外は絶対に投げない」* -- プロジェクト固有で、継続的に読み込まれます（エージェントが毎回のコード生成で読みます）。置き場所は `aidlc/spaces/<active-space>/memory/project.md` です。
- *「推奨ブランチ戦略はトランクベース開発である」* -- すべてのプロジェクトで同じ内容（フレームワークの見解）であり、継続的に読み込まれます（デリバリープランニングで読まれます）。置き場所は `aidlc/spaces/<active-space>/memory/org.md` です。
- *「一般的な 5 つのブランチ戦略とそのトレードオフ」* -- すべてのプロジェクトで同じ内容（フレームワークリファレンス）であり、継続的に読み込まれます（分岐戦略を発見するときにパイプラインデプロイ担当エージェントが読みます）。置き場所は `.claude/knowledge/aidlc-pipeline-deploy-agent/branching-strategies.md` です。
- *「この実行の要求分析」* -- プロジェクト固有で、ワークフロー単位です（各実行が新しい分析を生みます）。置き場所は `<record>/inception/requirements-analysis/` です。
- *「コンストラクション途中にpayments Unitをホストするワークツリーの状態」* -- プロジェクト固有で、ワークフロー単位です（スウォームモードのボルトごとに再生成されます）。置き場所はそのワークツリー側の記録ディレクトリのコピー、`.aidlc/worktrees/bolt-7c31e9a0_payments/<record>/aidlc-state.md` です。

### ハーネス設定（上段）の下位分類

上段はさらに**内容の形**で分割されます。

- **フレームワークのハーネスメカニクス** → メタデータ / JSON。ワークフロー順序、ステージ定義、成果物生成、ゲート意味論。ツールが決定論的に読みます。配置先は `.claude/skills/`, `.claude/tools/data/` です。
- **フレームワークのドメインリファレンス** → `.claude/knowledge/aidlc-<agent>-agent/` 配下のエージェント KB 散文。各ドメインにおける選択肢のメニュー（5 つのブランチ戦略、デプロイメントパターン、テスト方法論）。必要になった時に所有エージェントが読みます。
- **フレームワークの方法論既定値** → `aidlc/spaces/<active-space>/memory/org.md` にある散文。チームが別の確認をしない限りフレームワークが推奨する内容です。チームの声で書かれます（チームが上書きしないなら、組織層の既定値がそのままチームの声になるため）。
- **チームのプラクティス** → `aidlc/spaces/<active-space>/memory/team.md` にある散文。チームが選んだやり方、つまり「これが私たちの働き方」です。プラクティス発見の確認ゲートによって内容が入ります。エージェントは意思決定点で読みます（デリバリープランニングはブランチ戦略を読み、コンダクターは `SKILL.md` のウォーキングスケルトン方針を読みます）。
- **プロジェクトオーバーライド** → `aidlc/spaces/<active-space>/memory/project.md` にある散文。チーム層と組織層の既定値を上書きする、プロジェクト固有の修正です。これもプラクティス発見の確認ゲートによって内容が入ります。
- **ガードレール**（`## Forbidden`, `## Mandated`, `## Corrections` セクション） -- `org.md`, `team.md`, `project.md` に存在します。エージェント向けの是正ルール、つまり `ALWAYS X`, `NEVER Y` です。継続的にエージェントコンテキストへ読み込まれます。

### `.claude/` 直下へ置いてはいけないもの

設定のように見えても、そうではないケースが 2 つあります。

- **永続的なリポジトリ分析出力。** リバースエンジニアリングの 9 つのブラウンフィールド成果物（`code-structure.md`, `architecture.md` など）は、1 つのリポジトリに対する最新の走査を記述するものです。`.claude/` やインテントの記録ではなく、`aidlc/spaces/<active-space>/codekb/<repo>/` に置かれます。リバースエンジニアリングは該当する各ワークフローで再実行され、そのリポジトリ単位の共有ナレッジを更新します。
- **実行状態。** `aidlc-state.md` ファイルは、ワークフロー単位の現在時点の真実です。`.claude/` ではなくインテントの記録ディレクトリに属します。`audit/` の分割記録も同様です。

### 行をまたぐ昇格 -- プラクティス発見の例外

ほとんどのステージは 1 行だけに書き込みます。少数のステージは両方の行に書き込みますが、その行またぎ書き込みはチームの確認によってゲートされます。**これを行う唯一のステージがプラクティス発見（インセプション 2.2）です。** その出力は次のとおりです。

- `<record>/inception/practices-discovery/team-practices.md` -- ワークフロー単位の監査証跡（下段）。
- 確認後、内容はスペースメモリ層へコピーされます。`aidlc/spaces/<active-space>/memory/team.md` と `memory/project.md` の両方、つまりチーム著述のハーネス設定（右上セル）です。

監査証跡側のコピーは、この実行で何が確認されたかを証明します。`.claude/` 側のコピーは、今後のすべてのワークフローで読み込まれるチームの常設設定になります。

このパターン（走査 → 下書き → 確認 → 公開）は、構造としてはリバースエンジニアリングに一致します。違いは**結果**です。リバースエンジニアリングの確認は単に「この走査は正確だ」を意味しますが、プラクティス発見の確認は「フレームワークがこの文言を私たちの常設設定へ書き込み、今後のすべてのワークフローで読み込んでよい」を意味します。

この確認ゲートがなければ、フレームワークがチームの口を勝手に借りることになります。しかもその言葉はワークフローをまたいで永続します。ゲートがあることで、最終的には常にチーム自身がそれを書いたことになります。

このパターンはまれであり、意図的であるべきです。使ってよいのは次の 3 条件がすべて真のときだけです。
1. そのステージの出力が、チーム、プロジェクト、またはワークスペースに関する構成的真実である。
2. その真実が、この実行の下流ステージだけでなく、今後のすべてのワークフロー実行へ影響すべきである。
3. チームがその真実の著述者になる意思を持ち、単にフレームワークに書かせるのではなく、ゲートでレビューして承認する。

3 条件のどれか 1 つでも偽なら、既定はワークフロー単位専用です。

### 参照先

- [エージェントシステム](05-agent-system.md) -- エージェントファイル構造（左上セルのメカニクス）。
- [ナレッジシステム](10-knowledge-system.md) -- `knowledge/` の 2 層構造。
- [ステージ定義](15-stage-definition.md) -- ステージメタデータ仕様（ハーネスメカニクスのフォーマット）。
- [ステージプロトコル](04-stage-protocol.md) -- ステージごとの実行規則。

## 実行モデル

**インラインステージ** -- コンダクターは、ペルソナの枠組みとして先導エージェントのフラットファイル（例: `agents/aidlc-architect-agent.md`）と `knowledge/[agent]/` 内のナレッジを読み、そのうえで会話内でステージを直接実行します。これにより、質問、曖昧さの解消、承認前の成果物反復といったリアルタイムのユーザー対話が可能になります。

29 のステージがインライン実行です。これには 3 つすべての初期化ステージ（ワークスペーススキャフォールド、ワークスペース検出、状態初期化 — すべて `aidlc-utility intent-create` 内で決定論的に実行）、すべてのアイデエーションステージ、6 つのインセプションステージ（要件分析、精緻化モックアップ、ドメイン設計、ユニット生成、契約設計、デリバリープランニング）、6 つのコンストラクションステージ（機能設計、非機能要件、非機能設計、インフラ設計、ビルドとテスト、CI パイプライン）、およびすべてのオペレーションステージが含まれます。注記として、ビルドとテスト（3.6）は各ユニットごとではなく、すべてのユニット完了後に 1 回だけ実行されます。

**サブエージェントステージ** -- コンダクターはコンテキスト（先行成果物、プロジェクト記述、ワークスペースの所見）を準備し、Claude Code のタスクツールのサブエージェントへ委譲します。サブエージェントは自律実行し、構造化サマリーを返します。これは、実行中のユーザー対話なしで、集中した独立作業に向くステージで使われます。サブエージェント呼び出しが失敗した場合、コンダクターはコンテキストを減らしたプロンプトで 1 回再試行し、それでもだめならフォールバックとしてインライン実行か保留して再訪をユーザーへ提示します。

ディスパッチ実行を使うステージは 4 つです。リバースエンジニアリング（2.1、`mode: pipeline` — 開発者の走査の後にアーキテクトが統合と書き込みを行う）、プラクティス発見（2.2、`mode: subagent` — パイプラインデプロイのリードが下書きし、互いに見えない品質 / 開発者 / DevSecOps のスポークが検査し、人間インタビューを経てリードが統合する）、ユーザーストーリー（2.4、`mode: mob` — プロダクトリードの下書きにデザイン / 開発者 / 品質のコントリビューションラウンドが続く）、コード生成（3.5、集中した開発者サブエージェント）です。トポロジー全体は 29 インライン / 2 サブエージェント / 1 パイプライン / 1 モブです。ワークスペース検出（0.2）はサブエージェントではなく、`aidlc-utility intent-create` の内部で決定論的に実行されます。

```mermaid
flowchart LR
    subgraph INLINE["モード 1: インライン"]
        direction TB
        IN1["コンダクターが\nステージファイルを読む"]
        IN2["エージェントペルソナ\n+ ナレッジを読み込む"]
        IN3["会話内で\nステージ手順を直接実行"]
        IN4["ユーザー対話が\n利用可能"]
        IN5["承認ゲート\n(AskUserQuestion)"]
        IN1 --> IN2 --> IN3 --> IN4 --> IN5
    end

    subgraph SUBAGENT["モード 2: サブエージェント（単純）"]
        direction TB
        SA1["コンダクターが\nステージファイルを読む"]
        SA2["コンテキスト準備:\n成果物 + ペルソナ"]
        SA3["Task ツール呼び出し\n(subagent_type を指定)"]
        SA4["サブエージェントが実行\n(ユーザー対話なし)"]
        SA5["構造化サマリーを\nコンダクターへ返す"]
        SA6["コンダクターが\n完了 + 承認を提示"]
        SA1 --> SA2 --> SA3 --> SA4 --> SA5 --> SA6
    end

    subgraph TWOSTEP["モード 3: パイプライン（2 リンク RE チェーン）"]
        direction TB
        TS1["コンダクターが\nリバースエンジニアリングのステージファイルを読む"]
        TS2["Task: aidlc-developer-agent\nコード走査"]
        TS3["開発者が\n走査結果を返す"]
        TS4["Task: aidlc-architect-agent\n統合"]
        TS5["アーキテクトが\n9 個の成果物を生成"]
        TS6["コンダクターが\n完了 + 承認を提示"]
        TS1 --> TS2 --> TS3 --> TS4 --> TS5 --> TS6
    end

    style INLINE fill:#e8f5e9,stroke:#4caf50,color:#000
    style SUBAGENT fill:#e3f2fd,stroke:#2196f3,color:#000
    style TWOSTEP fill:#fff3e0,stroke:#ff9800,color:#000
```

### コンダクターのインラインステージ実行

```mermaid
sequenceDiagram
    participant O as コンダクター
    participant S as ステージファイル
    participant A as エージェントペルソナ
    participant U as ユーザー
    participant ST as 状態ファイル

    O->>S: ステージファイルを読み込む
    O->>A: 先導エージェントのペルソナ + ナレッジを読み込む
    O->>O: ステージ手順を実行する
    O->>U: 質問を提示する（3 モード）
    U-->>O: 回答を返す
    O->>O: 成果物を生成する
    O->>O: audit.md に記録する
    O->>U: 完了 + 承認ゲートを提示する
    U-->>O: 承認 / 変更依頼
    O->>ST: 承認を報告する（エンジンが `[x]` を付けてルーティングする）
    O->>O: 次のステージへ進む
```

### コンダクターのサブエージェント委譲

```mermaid
sequenceDiagram
    participant O as コンダクター
    participant T as タスクツール
    participant SA as サブエージェント
    participant U as ユーザー

    O->>O: ステージファイルを読み、コンテキストを準備する
    O->>T: サブエージェントを起動する（種別 + プロンプト + コンテキスト）
    T->>SA: 自律実行する
    SA->>SA: ファイルを読み、成果物を生成する
    SA-->>T: 構造化サマリーを返す
    T-->>O: 生成ファイル + 判断を含むサマリー
    O->>O: サマリーを検証し、問題点と懸念事項を確認する
    O->>U: 完了 + 承認ゲートを提示する
    U-->>O: 承認 / 変更依頼
    O->>O: 結果を報告する（エンジンが完了させ先へ進める）
```

## ソース対ディストリビューション（1 つのコア、複数のハーネス）

このフレームワークは**1 回だけ著述し、ハーネスごとに生成**されます。現在は Claude Code、Kiro CLI、Kiro IDE、Codex CLI、Cursor、opencode、GitHub Copilot、そしてそれを移植できるあらゆる CLI が対象です。
人手で著述するソースはハーネス中立な `core/` と、CLI ごとの薄い `harness/<name>/`
設定から成り、`bun scripts/package.ts` が Git 管理対象外のローカルな
`dist/<harness>/` ツリーを生成します。

```
core/                  # hand-authored, harness-neutral (tools, aidlc-common,
                       #   agents, rules, scopes, sensors, knowledge, hooks,
                       #   3 session skills); prose uses the {{HARNESS_DIR}} token
harness/<name>/        # per-CLI surface: manifest.ts + orchestrator skill +
                       #   harness files (+ emit.ts for codex)
scripts/package.ts     # the build: copy core (token→.claude/.kiro/.codex) +
                       #   harness, compile the graph, generate runners, emit;
                       #   both channels; --check builds twice and compares
scripts/build-binaries.ts # release binary compiler and smoke gates;
                       #   ignored build/binaries/ contains each executable
                       #   and runtime/<harness>/ bundle
dist/<harness>/        # GENERATED + ignored: claude/.claude, kiro/.kiro,
                       #   kiro-ide/.kiro, codex/{.codex,.agents},
                       #   opencode/{.aidlc,.opencode}, copilot/{.aidlc,.github} — never hand-edited
```

`core/` の `.ts` は変換なしでバイトコピーされます。ランタイムの `harnessDir()` という継ぎ目
（`core/tools/aidlc-lib.ts`）は、ハードコードした一覧ではなくツール自身のパスから出荷済みレイアウトを
実行時に導出するため、新しいハーネスを追加してもここへの編集は不要です。またマニフェスト名とルールディレクトリの名前変更は、
ツリーごとに生成される `tools/data/harness.json` に格納されて出荷され、ランタイムのパス解決はその名前を使って共有エンジンディレクトリを区別し、`rulesSubdir()` の継ぎ目がその名前変更を読みます。
1 セットのツールソースがすべてのハーネスで動きます。詳しくは
[新しいハーネスへの移植](../harness-engineering/09-porting-to-a-new-harness.md) を参照してください。

`dist/` と `dist-release/` は同じソースから生成するローカルのツリーで、どちらも Git 管理対象外です。`dist/` の開発用チャネルは生成された TypeScript ディスパッチャーを Bun で実行します。`dist-release/` のリリース用チャネルは、フック、生成コマンド、アダプター、ホストの信頼設定をネイティブ `aidlc` ディスパッチャーへ接続します。ホストの信頼シードなど、ネイティブ専用のルート統合はリリース用にだけ追加します。`package.ts --check` は独立した一時ディレクトリで全ツリーを 2 回生成し、バイト単位で比較します。CI、テスト、バイナリビルド、リリースパッケージ作成は、これらを使う前に再生成します。

### 生成物の識別情報と所有権

各ハーネスの `tools/data/` には、役割の異なるメタデータがあります。

- `harness.json` は実行時設定です。配布名、製品名、次の操作の文言、ハーネスとルールのディレクトリ、プラグイン選択、および任意の `models`、`runtime`、`providers`、`trust`、`flags`、`project` レコードなど、変更可能なプロジェクト設定を保持します。
- `agent-tiers.json` は `core/agents/*.md` のフロントマターから生成するエージェント名とティアの対応表です。実行時のモデルポリシーは、エージェント一覧をコードに固定せず、このファイルを読みます。
- `aidlc-stamp.json` は変更しない生成物の識別情報です。スキーマ、フレームワークのバージョン、配布名、ハーネスディレクトリを記録します。
- `aidlc-projection.json` は全出力を網羅するインストール定義です。すべての最上位出力を、フレームワーク管理ディレクトリかルート統合に分類します。ルート統合には `managed-block`、`json-map`、`json-array`、`whole-file` のいずれかの統合ポリシーを指定します。任意の統合や旧コピーの正確なハッシュもここに宣言します。未分類の最上位項目があると、パッケージ作成または読み込みは失敗します。

`aidlc config` は計画を作る前に stamp とインストール定義を検証します。インストール先には、プロジェクト固有の所有権の基準として `aidlc-manifest.json` を書き込みます。内容は upstream バージョン、各ファイルのハッシュ、Claude設定とCodexテーブルの出荷時エントリのハッシュ、ルートへの追加内容、任意の統合の選択モードです。更新時はこの基準を使い、変更されていない管理ファイルを更新し、ローカルの変更を保護し、ルート統合をマージし、廃止した管理対象を削除します。ネイティブ定義に記録したコピー用ハッシュと一致する、未変更の旧コピーインストールは引き継げます。未知の内容をフレームワーク所有と推測することはありません。

### モデルポリシーの反映

`aidlc config models` は既存の公開コマンド `config` の一機能です。第 7 の公開コマンドではありません。ポリシーはハーネスのメタデータではなく、共有の設定階層に置きます。

- マシンのインストールルートにある `aidlc.settings.json`
- プロジェクトルートにある `aidlc.settings.json`
- プロジェクトルートにある `aidlc.settings.local.json`

この順に末端の項目ごとにマージし、最後に環境変数の上書きを適用します。local ファイルは個人用で Git 管理対象外、project ファイルはチーム共有です。

```json
{
  "schemaVersion": 1,
  "models": {
    "schemaVersion": 1,
    "preset": "thorough",
    "groups": {
      "reviewing": { "effort": "xhigh" }
    },
    "agents": {
      "architect": {
        "effort": "xhigh",
        "model": { "claude": "provider/raw-id" }
      }
    },
    "profiles": {
      "my-profile": {
        "groups": {
          "reviewing": { "effort": "medium" }
        }
      }
    }
  },
  "flags": {
    "schemaVersion": 1,
    "swarm": true
  }
}
```

解決順は、エージェントごとの例外、グループ設定、出荷時のティア既定値、セッションからの継承です。出荷時の既定値には共有のティア変換モジュールと有効なティア上限の解決器を使い、モデル表を複製しません。Claude と Cursor の Markdown、Codex の TOML、opencode の Markdown、Kiro のエージェント JSON と `chat.modelDefaults` は、パッケージ生成と config 更新で同じ書き込み処理を使います。

更新時は、解決した設定階層を未変更の一時生成物へ渡し、`planManagedFiles` がハッシュを計算する前にモデルとフラグの設定を反映します。ポリシーのキーを `harness.json` へコピーしません。そのため、後から通常の `aidlc config` を実行してもポリシーを再適用できます。管理対象のエージェントファイルを手で変更していた場合は、通常の更新競合として扱います。

対応しないポリシーは明示します。ハーネスが表現できる設定を報告し、近い値に丸める場合も強度を下げる方向だけに制限します。選んだハーネスが無視するキーは書かず、実際のプロバイダーへの接続検証も行わず、ステージファイル経由でモデルポリシーを指定することもありません。

### ランタイム、プロバイダー、信頼設定の診断

`core/tools/aidlc-config-diagnostics.ts` は、`aidlc config runtime`、`aidlc config providers`、`aidlc config trust` と対応する doctor 項目の共有実装です。各機能はスキーマバージョン付きの回答レコードを `harness.json` に保存します。ランタイムローダーはこれらの任意の兄弟キーを無視します。

ランタイム診断はログインシェルに依存しないフック用 PATH を求め、インストール済みフックが必要とするコマンドだけを解決し、選択されたハーネス CLI を調べます。保存した絶対パスは診断の証拠です。フックのコマンドを書き換えるものではありません。ホストの許可リストと Codex の信頼ハッシュは、元のコマンド接頭辞に結び付きます。

プロバイダーの検出は、ローカルの AWS 環境変数、プロファイル、認証情報、ロール、SSO キャッシュだけを読みます。Bedrock のリージョンとプロファイルの回答は、管理ファイルのハッシュ計算前に一時生成物へ反映します。Claude では AWS MCP のエンドポイントとメタデータも同じリージョンへ変更します。Codex のモデルと effort のキーは変更しません。OpenCode のプロバイダー設定はユーザーが提案を承認した場合だけ書き込みます。手順案内のみを行うハーネスでは、機能しない設定キーを書かず確認済みであることを記録します。

オフラインでは検証できないプロバイダー操作は、小さな保留操作一覧として保存します。config と doctor は操作 ID から説明文を生成し、レコードには ID と pending/done だけを保持します。

信頼設定の診断は既存のホスト設定を読みます。Codex はユーザー設定内のプロジェクト固有シード一式、Kiro IDE はインストール済みの trusted command、各ハーネスは必要な兄弟ディレクトリを確認します。config trust は信頼シードや許可ルールの生成処理を呼びません。

dry-run 以外の config トランザクションが成功すると、インストール済み内容に対して軽量な適用後診断を行います。ランタイム診断は非対話 PATH 上で実際のフックが必要とするバイナリだけを解決し、ハーネス CLI のバージョン検査は省きます。信頼設定はホスト設定を読み、プロバイダーは記録済みの保留操作だけを読みます。通常出力と quiet 出力には必要な機能別の後続操作を表示し、JSON には構造化した `outstandingActions` 配列を返します。トランザクションは成功しているため、終了コードは 0 です。

doctor は `tools/data/aidlc-manifest.json` から指示ファイルの診断項目を作ります。managed-block ではマーカーが正しい順序で 1 組あり、ブロックのハッシュが記録と一致することを確認します。フレームワーク所有の whole-file 指示ファイルは、ファイル全体の記録済みハッシュと比較します。正常・欠落・ローカル変更を区別し、複数ハーネスのプロジェクトでは呼び出し元のハーネスを選びます。

### フラグとプロジェクトの選択

`aidlc config flags` はスキーマバージョン付きの `flags` レコードを `harness.json` に保存します。`readShippedHarnessData` は既存のプラグイン選択とともにこれを読み、`resolveProjectFlag` が環境変数を優先する共通の参照処理を提供します。既存のツールとフックは環境変数の動作を保ち、変数がない場合だけレコードの値を使います。コンダクターが管理する swarm の選択も同じ優先順位です。

flags レコードには既定スコープ、swarm、フックのデバッグ、センサーのタイムアウト、文書化された固定のバイパス環境変数群を含めます。スコープ検証はインストール済みのフロントマターを読みます。Claude の設定生成では `AWS_AIDLC_DEFAULT_SCOPE` も更新します。これを行わないと、出荷時のセッション環境変数がレコードより優先されるためです。

`aidlc config project` は MCP と補完設定の回答を、スキーマバージョン付きの `project` レコードへ保存します。プラグイン選択は従来どおり最上位の `plugins` 配列に置きます。インストール済みプラグインはグラフ、スコープ、プラグインの sidecar データから検出します。通常の更新ガードにより、これらの選択変更が進行中のワークフロー計画を変えることを防ぎます。

MCP への同意は同じトランザクション中と後続の通常更新で、Claude の同意管理対象 `.mcp.json` に対するルート統合モードへ渡します。MCP 診断は Claude の配置を仮定せず、ホストごとに分類します。Kiro の設定ファイルは常に出荷されるため、`defaults` は存在を確認し、`none` は手順の案内だけを行います。現在 MCP ファイルを持たないハーネスでは、修復不能な差分を発生させず回答を記録します。補完の回答からは、ネイティブ用またはコピー用の正確な手順を生成します。config がシェルのプロファイルなどマシン単位のファイルへ書くことはありません。

更新時は 3 つのレコードを未変更の一時 `harness.json` にマージし、プロバイダーの書き込み処理がホスト設定を変更してから `planManagedFiles` がハッシュを計算します。後続の通常の `aidlc config` でも回答が再適用され、reset すると変更前の出荷時既定値へ戻ります。

### ディスパッチャーのルートポリシー

`core/tools/aidlc.ts` は両チャネルのルート一覧であり、コンパイル済みバイナリの入口です。各ルートはプロジェクト要件、出力モード、ネットワークポリシー、変更範囲、公開範囲、および次のいずれかの pin ポリシーを宣言します。

- `active` はマシンのライフサイクル操作や管理コマンドを現在有効なバイナリで実行します。
- `inspect` も有効なバイナリを使い、`doctor`、`init`、`use` が壊れたプロジェクトの pin を診断・修復できるようにします。
- `pinned` はプロジェクトのエンジン用です。有効な `.aidlc-version` があれば、プロジェクトデータを読む前に保持済みのその版へ 1 回だけ再実行します。指定版が欠落または不完全なら、インストールコマンドを示して拒否します。

ディスパッチャーは解決したルートポリシーを `AIDLC_ROUTE_*` 環境変数で委譲先へ渡します。リリース取得とトランザクションエンジンがネットワークと変更範囲を制御します。セッション単位の fingerprint キャッシュにより、pin の検証を弱めず保持版の完全検査の繰り返しを避けます。

### 共有トランザクションエンジン

インストール機構の変更処理は `core/tools/aidlc-transaction.ts` を使います。計画はルート相対で重複しない `write`、`copy`、`tree`、`remove`、`symlink` 操作の集合で、操作先の期待状態を持ちます。コピー元には内容のハッシュも付けます。変更前に、範囲外パス、シンボリックリンク経由の参照、特殊ファイル、ファイルシステム境界越え、コピー元の変化、対象の重複を拒否し、ルートロックの保持中にも検証を繰り返します。

候補を一時配置して fsync してから実体へ書き込み、現在の対象をスナップショット化し、rename を境にコミットします。候補とコミット済み内容の検証器により、呼び出し元は固有の不変条件を確認できます。一時配置、コミット、検証、監査のいずれかが失敗すると、コミットしたパスを逆順で復元します。ロールバックに失敗した場合は復旧情報を残し、次のトランザクションが放置された一時配置を削除せず隔離します。プロジェクトの初期化・更新、マシンのライフサイクル、project pin、プラグイン選択・同期は、すべてこのエンジン用の計画を作ります。

### リリースの組み立てと来歴

`scripts/build-binaries.ts` は配布ツリーを再生成し、`dist-release/claude/.claude/tools/aidlc.ts` からディスパッチャーをコンパイルします。各対象バイナリの隣に全ネイティブランタイムを配置してスモーク検証し、`build-results-<target>.json` を書きます。ホストで実行できる成果物は、ネイティブ実行と最終配置に対する検証一式を通った場合だけ `VERIFIED` になります。クロスビルド成果物は `inspection-only` の証拠を伴う `UNVERIFIED` として明示します。

`scripts/package-release.ts` はローカルの配布ツリーを再生成し、2 回のビルドで決定性を検証します。ビルド結果のレコードを検証し、リリースモードでは 7 対象すべてが揃っていることも確認します。各 `dist-release/<harness>/` と Bun 用 `aidlc-copy-runtime-X.Y.Z.tar.gz` をアーカイブ化し、フラットな `version.json`、`checksums.txt`、両インストーラー、バイナリを出力します。一時公開ジョブは候補を再検証し、署名せずアップロードします。Unix と Windows のライフサイクルジョブは、そのチェックサムを検証してテストします。`publish` は同じ候補を取得・再検証して証明を付け、書き出した `aidlc-release.intoto.jsonl` バンドルを追加し、全ファイル一覧を検証して、1 つの `attested-release` ワークフロー成果物をアップロードします。`release` はタグとチェックサムを再確認し、このリポジトリの `GITHUB_TOKEN` で GitHub Release を作り、公開済みの全ファイルを検証します。バンドルは独立した信頼経路なので、`version.json` と `checksums.txt` には含めません。このパイプラインでは、将来予定の npm チャネルは実装していません。[サプライチェーンセキュリティ](19-supply-chain-security.md) を参照してください。

## ディレクトリ構造

ソースから生成する Claude 配布ツリー（`dist/claude/.claude/`。`core/` + `harness/claude/` から生成。リリースアーカイブではネイティブ版を `runtime/claude/.claude/` に配置）:

```
dist/claude/.claude/
+-- CLAUDE.md
+-- settings.json
+-- hooks/
|   +-- aidlc-write-audit-log.ts
|   +-- aidlc-sync-workflow-state.ts
|   +-- aidlc-validate-state.ts
|   +-- aidlc-log-subagent.ts
|   +-- aidlc-session-start.ts
|   +-- aidlc-session-end.ts
|   +-- aidlc-statusline.ts
+-- rules/
|   +-- aidlc.md                  # @-import stub -> ../../aidlc/spaces/<active-space>/memory/ (NOT a copy; re-pointed in place on `space` switch)
+-- agents/
|   +-- aidlc-product-agent.md
|   +-- aidlc-design-agent.md
|   +-- aidlc-delivery-agent.md
|   +-- aidlc-architect-agent.md
|   +-- aidlc-aws-platform-agent.md
|   +-- aidlc-compliance-agent.md
|   +-- aidlc-devsecops-agent.md
|   +-- aidlc-developer-agent.md
|   +-- aidlc-quality-agent.md
|   +-- aidlc-pipeline-deploy-agent.md
|   +-- aidlc-operations-agent.md
+-- knowledge/
|   +-- aidlc-shared/
|   |   +-- ai-dlc-principles.md
|   |   +-- verification.md
|   |   +-- brownfield.md
|   |   +-- audit-format.md
|   |   +-- state-template.md
|   |   +-- knowledge-readme-template.md
|   +-- aidlc-product-agent/
|   |   +-- requirements-guide.md
|   |   +-- product-guide.md
|   |   +-- functional-design-guide.md
|   |   +-- requirements-elicitation.md
|   |   +-- prioritization-frameworks.md
|   |   +-- user-story-patterns.md
|   |   +-- market-research-methods.md
|   +-- aidlc-architect-agent/
|   |   +-- architecture-guide.md
|   |   +-- nfr-design-guide.md
|   |   +-- ddd-patterns.md
|   |   +-- architecture-patterns.md
|   |   +-- nfr-design-patterns.md
|   |   +-- adr-template.md
|   +-- aidlc-developer-agent/
|   |   +-- code-analysis-guide.md
|   |   +-- code-generation-guide.md
|   |   +-- code-generation-patterns.md
|   |   +-- api-design-guide.md
|   |   +-- data-modelling-patterns.md
|   |   +-- re-artifacts.md
|   +-- [... 8 more agent knowledge dirs]
+-- skills/
    +-- aidlc/
        +-- SKILL.md
        +-- stage-protocol.md
        +-- stage-protocol-recovery.md
        +-- stage-protocol-governance.md
        +-- stage-protocol-reviewer.md
        +-- stage-protocol-ensemble.md
        +-- stage-protocol-construction.md
        +-- stage-protocol-swarm.md
        +-- stages/
            +-- initialization/
            |   +-- workspace-scaffold.md
            |   +-- workspace-detection.md
            |   +-- state-init.md
            +-- ideation/
            |   +-- intent-capture.md
            |   +-- market-research.md
            |   +-- feasibility.md
            |   +-- scope-definition.md
            |   +-- team-formation.md
            |   +-- rough-mockups.md
            |   +-- approval-handoff.md
            +-- inception/
            |   +-- reverse-engineering.md
            |   +-- practices-discovery.md
            |   +-- requirements-analysis.md
            |   +-- user-stories.md
            |   +-- refined-mockups.md
            |   +-- domain-design.md
            |   +-- units-generation.md
            |   +-- contract-design.md
            |   +-- delivery-planning.md
            +-- construction/
            |   +-- functional-design.md
            |   +-- nfr-requirements.md
            |   +-- nfr-design.md
            |   +-- infrastructure-design.md
            |   +-- code-generation.md
            |   +-- build-and-test.md
            |   +-- ci-pipeline.md
            +-- operation/
                +-- deployment-pipeline.md
                +-- environment-provisioning.md
                +-- deployment-execution.md
                +-- observability-setup.md
                +-- incident-response.md
                +-- performance-validation.md
                +-- feedback-optimization.md
```

### ワークスペース: スペースとインテント

上のツリーは**エンジン**であり、ハーネス固有で、ユーザーが閲覧するものではありません。
エンジンが**実行時に読み書きする**ものはすべて、プロジェクトルートの別個の中立ディレクトリ
`aidlc/` に置かれ、2 段コンテナとして整理されます。
**スペース → インテント** です（利用者向けの導入はユーザーガイドの
[スペースとインテント](../guide/03-spaces-and-intents.md) を参照。この節は
エンジンが解決対象とするデータモデルです）。

```
aidlc/                                    # neutral, harness-independent, committed to git
+-- active-space                          # cursor: active space name (gitignored, per-user)
+-- spaces/
    +-- default/                          # one space per team; "default" is auto-resolved
        +-- memory/                        # the method — org.md/team.md/project.md, phases/, templates/
        +-- knowledge/                     # space-level domain knowledge (free-form)
        +-- codekb/<repo>/                 # per-repo code knowledge base
        +-- intents/
            +-- active-intent              # cursor: active intent record dir (gitignored, per-user)
            +-- intents.json               # the registry: [{ uuid, slug, dirName, scope, repos, status }]
            +-- <YYMMDD>-<label>/          # one record dir per intent (date-prefixed, short kebab label; UUIDv7 carries identity in intents.json)
                +-- aidlc-state.md          # per-intent workflow state
                +-- audit/<host>-<clone>.md # per-clone audit shards (glob-and-merge by timestamp)
                +-- <phase>/<stage>/*.md    # artifacts + the per-stage memory.md diary
```

**解決。** ワークフローのアイデンティティは、ライブラリ内の単一のチョークポイントで、
`in-process sessionId > AIDLC_SESSION_OVERRIDE > PID ancestry > none` という優先順位で
解決されます。フックペイロードのアイデンティティはインプロセスの選択肢を使い、これが
正式な情報源です。不正な環境変数値は無視されます。祖先関係と食い違う有効な環境上書きは、
バインディングやワークフロー記録のパスが導出される前に、型付きの拒否を投げます。
明示的なセレクターと、その結果生じるマシンローカルなセッションバインディングが、
共有される 2 つの利用者ごとカーソルより優先されます。

SessionStartはPIDの同一性を確認するまで`sessionId: null`の障壁で旧セッションを失効させます。POSIXでは照会前に書き込みます。Windowsは先に親子関係を検査し、親が子と同時刻または新しい場合は、そのPID記録をGCでも変更しません。照会できない場合は既知の親スロットを失効させて停止し、未検証のセッションを公開しません。失敗・タイムアウト後に旧セッションが復活することはなく、次の正常なSessionStartが障壁を置き換えます。

- **スペース** -- 優先順位は `explicit arg > session binding > aidlc/active-space
  cursor > "default"` です
  （`DEFAULT_SPACE`, `core/tools/aidlc-lib.ts:591`; 解決器 `activeSpace()`,
  `aidlc-lib.ts:1300`）。`listSpaces()` はディスク上に何もなくても常に `default` を報告します
  （`aidlc-lib.ts:1973`）。
- **インテント** -- 優先順位は `explicit arg > session binding >
  aidlc/spaces/<space>/intents/active-intent` カーソル（それが `aidlc-state.md` を保持する
  実在の記録を指す場合）`> lone-intent > null` です。`null` のインテントは
  「まだ記録が存在しない」を意味し、オーケストレーターが最初のインテントを自動作成する合図になります。

セッションバインディングは
`aidlc/.aidlc-sessions/<safe-session-id>.binding.json` に置かれます。生成された（spawn された）ツールは、
`aidlc/.aidlc-sessions/pids/<pid>` の最も近い生存エントリーを通じて
自分のセッションを発見します。どちらのストアも gitignore 対象のベストエフォートであり、
カーソルはライトスルーのフォールバックとして残ります。エンジンは、解決したアイデンティティを
`AIDLC_SESSION_OVERRIDE` を通じて子ツールへ渡します。この環境変数は、ハーネスプロセスに
設定された場合、ヘッドレス自動化のための継ぎ目にもなります。

Codex アダプターはさらに、検証済みのペイロードアイデンティティをすべての POSIX Bash
コマンドとコアフックの子プロセスへピン留めするため、サンドボックス化された macOS は
`ps` の祖先関係に依存しません。Windows x64/arm64では安定した`OpenProcess`ハンドルを使い、`NtQueryInformationProcess(ProcessBasicInformation)`・`GetProcessTimes`・待機時間0の生存検査から祖先を調べます。48バイト構造体の長さとPIDを検証し、全経路でハンドルを閉じます。作成時刻を精度を失わず保存し、親が子より前に生成されたことを要求します。検証した作成時刻のないreceiptは所有権を示しません。照会失敗・曖昧な親子関係・50msまたは64階層の上限では祖先セッションを返しません。POSIXコマンド書換えはWindowsには適用しません。同一プロセスのKiro IDEチャットやopencodeセッションは祖先だけで区別できず、payloadまたは`AIDLC_SESSION_OVERRIDE`がなければ共有カーソルへ戻ります。

プロジェクトを認識するパスヘルパーも同じ選択の階段で解決します。明示的なセレクター、
次にセッションバインディング、最後のフォールバックとして共有カーソルの順です。
解決済みの `intent:null` を受け取ったヘルパーは、素のスペースルートを選ぶ際に、
その選択されたスペースを保持します。
`/aidlc space <name>` でスペースを切り替えると、
各ハーネス固有のルール取り込み（上で述べた Claude の `@` による取り込み用スタブ、
Kiro CLI のリソースまたは Kiro IDE のステアリング、Codex のルールディレクトリ、opencode の `instructions` グロブ、Copilot の `AGENTS.md` `@` 取り込み）も切り替え先スペースの
`memory/` を指すよう再ポイントされます。`default` では再ポイントはバイト単位で同一の無操作なので、
単一チームのコミット済みツリーが無駄に書き換わることはありません。SessionStart は
この再ポイントに解決済みのセッションスペースを使いますが、この取り込みはチェックアウト
全体で 1 つの可変サーフェスのままです。つまり、ワークフローの選択はスペースをまたいで
セッションに束縛される一方、複数スペースへのアンビエントなメソッド配信が同時に起きると
依然として競合し得ます。

**コミット対象と無視設定。** `aidlc/` はチームで作業を共有するためチェックインされます。
その分割（`harness/claude/dot-gitignore:34-54`）は次のとおりです。2 つのカーソル
（`active-space`, `active-intent`）、クローンごとのランタイム（`.aidlc-clone-id`,
`.aidlc-sessions/`）、派生状態（`runtime-graph.json`、記録配下の `.aidlc-*`）
は **無視対象**です。一方で、方法論（`memory/**`）、ナレッジ（`knowledge/**`,
`codekb/**`）、`intents.json` レジストリ、各記録の `aidlc-state.md`、`audit/`
の分割記録、成果物は **コミット対象**です。監査はクローンごとの分割記録
（`audit/<host>-<clone>.md`）としてコミットされます。これはバージョン管理が同時追記を
マージしなくて済むようにするためで、意図的に `merge=union` 属性はありません。

## 主要な設計判断

1. **ハイブリッド実行モデル（インライン + ディスパッチトポロジー）** -- ユーザー対話（質問、曖昧さの解消、承認反復）が必要なステージは、コンダクターが会話へ直接アクセスできるインラインで走ります。集中した自律作業（コード走査、コード生成）や本物のマルチエージェント協働（モブ）を行うステージは、ステージの `mode` トポロジーに従ってサブエージェントへディスパッチされます。純サブエージェントモデルではステージ途中のユーザー対話が不可能になり、純インラインモデルでは集中したエージェント特化や独立した視点の利点を活かせません。

2. **インラインステージ向けエージェントペルソナ** -- インラインステージでは、コンダクターはサブエージェントへ委譲する代わりに、視点付けのためにエージェントのフラットファイルをコンテキストとして読み込みます。これにより、ドメイン専門家としてのフレーミング（ドメイン設計中にコンダクターがアーキテクトのように考える）という利点を得つつ、サブエージェントへのコンテキスト転送コストやユーザー対話喪失を避けられます。

3. **2 リンクのリバースエンジニアリングパイプライン** -- リバースエンジニアリング（`mode: pipeline`）では、まずコード走査のための開発者サブエージェント、次に統合と成果物書き込みのためのアーキテクトサブエージェントを使います。コンダクターがバスとなり（Claude Code ではサブエージェントがサブエージェントを起動できません）、開発者のコード走査結果をアーキテクトへ渡します。これはチェーントポロジーが設計どおりに機能している姿です。

4. **`aidlc-state.md` による状態追跡** -- 単一の Markdown 状態ファイルが、ステージ完了状況、現在ステータス、ワークスペース文脈、スコープ設定、実行計画、ランタイム状態（改訂回数と、receiptに結び付く`Construction Verification Command`を含むConstruction設定）を追跡します。ステージは結果をオーケストレーションエンジンへ報告します。エンジンの内部状態遷移がこのファイルを更新し、ライフサイクル監査行を出力し、原子的にルーティングします。ステージの散文がライフサイクルのチェックボックスを直接編集することは決してありません。ツール使用後フックが、書き込みのたびに状態ファイル構造を検証します。ステージレベルのタスク ID は状態ファイルへ保存せず、実行時に `TaskList` から解決されます（`"Inception - Requirements Analysis"` のような件名で照合）。これはコンテキスト圧縮後でも実際のタスクシステム状態を反映するため、より堅牢です。

5. **共有契約としてのステージプロトコル** — 33 ステージが stage-protocol.md を読み、承認ゲート・3 つの質問モード・完了メッセージ・状態追跡を共有します。Recovery と governance は条件付きです。reviewer・ensemble・Construction・swarm・§13 learnings の 5 モジュールは directive.protocol_modules で選択します。learnings が日誌と学びの手続きを所有し、指定がなければどちらも実施しません。

6. **2 層ナレッジアーキテクチャ** -- 方法論ナレッジはフレームワーク同梱の `knowledge/` に出荷されます（共有原則 + エージェント別方法論）。ユーザー管理のチームナレッジは、スペースレベルの `aidlc/knowledge/`（そのスペースの `intents/` の兄弟）に置かれ、エンジンが空で作成し、チームが中身を入れます。これにより、フレームワークのアップグレードとチームのカスタマイズが分離されます。

7. **フラットなエージェントファイル** -- 各エージェントは `agents/` 内の単一 `.md` ファイルです（`agent.md` + `knowledge/` を持つサブディレクトリではありません）。これにより構造が単純になり、エージェントが見つけやすくなります。方法論ナレッジは `knowledge/[agent]/` に分離して置かれます。

8. **スコープ駆動の適応深度** -- 11 個の命名済みスコープ（エンタープライズ、機能、MVP、概念実証、バグ修正、リファクタリング、インフラ、セキュリティパッチ、クラシック、ワークショップ、エクスプレス）と自動検出が、どのステージをどの深さで実行するかを決めます。各スコープは `.claude/scopes/aidlc-<name>.md` ファイル（アイデンティティ）であり、所属は各ステージのメタデータ `scopes:` タグです。これはコンパイル時に EXECUTE/SKIP グリッド（`.claude/tools/data/scope-grid.json`、正本）へ転置され、`SKILL.md` 内のサマリーテーブルにもコンパイルされます（参考用）。自然言語のキーワードからスコープへの推論は、各スコープ `.md` メタデータの `keywords` を読みます。ユーザーはどの承認ゲートでも上書きできます。

9. **最小限のルール** -- ガードレールだけ（合計およそ 35 行）がアクティブなスペースメモリ層（`aidlc/spaces/<active-space>/memory/`。`.claude/rules/aidlc.md` の `@` による取り込み用スタブ経由で読み込まれる）に置かれます。それ以外（検証、ブラウンフィールド保護策、監査フォーマット、適応パターン）は `knowledge/aidlc-shared/` か、静的／条件付きのプロトコルファイルに置きます。ルールは常に読み込まれるため、これにより AI-DLC 以外の会話でコンテキスト膨張を防げます。

10. **自己学習ループ** -- 人間がエージェントの振る舞いを修正すると、その修正は永続的なルールになり得ます。§13 の学習儀式（ツールが主体。`aidlc-learnings.ts` が候補を提示して永続化し、ユーザーが確認する）は、確認済み学習を各プラクティスとしてアクティブなスペースメモリ層へ書き込みます。既定では `aidlc/spaces/<active-space>/memory/project.md`、ワンクリックで `memory/team.md` へ昇格もできます。あるいはセンサーをスキャフォールドし、次のワークフローのコンパイルで適用されます。詳細は [ルールシステム](08-rule-system.md) を参照してください。

11. **フェーズ境界検証** -- トレーサビリティチェックはフェーズ遷移時に自動実行されます（初期化→アイデエーションの自動進行、アイデエーション→インセプション、インセプション→コンストラクション、コンストラクション→オペレーション）。これにより、要件から設計へのリンク欠落、孤立した成果物、不整合を、下流ステージが不完全な基盤の上に積み上がる前に捕捉します。

12. **フックベースの監査ロギング** -- 書き込み・編集操作に対するツール使用後フックが、成果物の作成と変更をインテントの `audit/` 分割記録へ自動記録します。圧縮前フックはコンテキスト圧縮前に状態ファイル構造を検証します。サブエージェント停止フックはサブエージェント完了を記録します。105イベントの分類体系（`knowledge/aidlc-shared/audit-format.md` で定義。[状態機械](12-state-machine.md) にイベント発生元レジストリの説明あり）により事後分析が可能です。主要イベントには `STAGE_STARTED`, `STAGE_COMPLETED`, `DECISION_RECORDED`, `SCOPE_CHANGED`, `RULE_LEARNED` があります。

13. **ネストした委譲なし** -- コンダクター（`SKILL.md`）がすべてのエージェントタスク呼び出しを行います。エージェント同士が互いを呼び出したり、サブエージェントを起動したりはしません。これにより、委譲グラフがフラットでデバッグしやすく保たれます。

14. **4 つのセッション再開オプション** -- チェックポイントから再開、現在ステージをやり直し、特定ステージへジャンプ、または新規開始（アーカイブ確認付き）です。これにより、ユーザーは状態ファイルを手編集せずに、ワークフローの進行を細かく制御できます。

15. **ステージ / フェーズジャンプコマンド** -- `--stage <slug|#>` と `--phase <name|#>` は、特定のステージまたはフェーズへ直接ジャンプします。`--scope <scope>` はワークフロースコープを設定または上書きします。前方ジャンプは中間ステージを `[S]`（スキップ済み）としてマークし、後方ジャンプは下流ステージを `[ ]` に戻して対象から前方再生します。相互に組み合わせ可能です。

## ディレクトリ構造: テスト

```
tests/
+-- run-tests.ts              # Native Bun test runner (all levels, flag-selectable)
+-- run-tests.sh              # POSIX compatibility wrapper for run-tests.ts
+-- gen-coverage-registry.ts  # Generates .coverage-registry.json from covers: headers
+-- .coverage-registry.json   # Machine-checked coverage index (units x test files)
+-- .coverage-ratchet.json    # Coverage floor the registry --check enforces
+-- README.md                 # Discoverable suite index + quick reference
+-- lib/
|   +-- bun-junit-to-meta.ts  # Bun JUnit -> runner metadata glue
+-- harness/                  # Shared TS helpers: fixtures, sdk-drive, tui-drive, windows/
+-- fixtures/                 # State files, stub projects, RE artifacts
+-- hooks/
|   +-- pre-commit            # Git hook: runs the default levels (smoke + unit + integration)
+-- smoke/                    # Level: structural validation (no LLM, seconds)
+-- unit/                     # Level: single-component isolation (no LLM)
+-- integration/              # Level: cross-component contracts + live stage/CLI utilities
+-- e2e/                      # Level: full lifecycle, worktree, rendered terminal journeys
```

あらゆるテストは `bun` で走る `t*.test.ts` ファイルであり、シェルテスト
ファイルはありません。4 つのディレクトリが、このスイートの 4 レベルを構成します。

## テスト

このプロジェクトのテストスイートは**完全に TypeScript** 製で（`.sh` テストファイルは 0）、
`smoke`, `unit`, `integration`, `e2e` の 4 レベルに整理されています。これは
古典的な 3 層ピラミッド（スモーク + ユニット = L1 プロトコル、統合 =
L2 ステージ、エンドツーエンド = L3 受け入れ）に対応します。すべて TS であることで、スイートは
構造上クロスプラットフォームになります。つまり、同じファイルが主要なデスクトップ・サーバー OS とネイティブ
Windows で同一に動きます。テストはファイル存在確認からレンダリング済みターミナルの
一連の操作まであらゆるものを検証し、フック、エージェント、ステージ、設定への変更が
リグレッションを持ち込まないことを保証します。

### テストレベル

| レベル | ディレクトリ | 対象 |
|-------|-----------|----------------|
| **スモーク** (L1) | `tests/smoke/` | ファイル存在、エージェント / ステージ / プロトコル構造、`SKILL.md` グラフ整合性、`settings.json` スキーマ。欠落ファイルや誤命名ファイルを捕捉する高速な構造チェックです。LLM は使いません。 |
| **ユニット** (L1) | `tests/unit/` | 16 個のフック、CLI ツール、ステージ / エージェントのメタデータ、ナレッジインベントリ、オーケストレーションエンジンハンドラー、そのほか単一コンポーネント契約。各テストは 1 コンポーネントを隔離します。LLM は使いません。 |
| **統合** (L2) | `tests/integration/` | コンポーネント横断契約（スコープからステージへの対応、ステージとエージェントのクロスチェック、プロトコル準拠、監査 / ランタイムグラフのエンドツーエンド）と、`claude` CLI または SDK を通して駆動される実行中のステージ / CLI ユーティリティ。`claude` がなければ実行中のファイルはきれいにスキップされます。 |
| **E2E** (L3) | `tests/e2e/` | フルライフサイクルとワークツリープリミティブ、さらに実際のユーザー質問ゲートへ答えるとディスク状態が進むことを証明するレンダリング済みターミナル（`tui-drive.ts`）の一連の操作。実行中の一連の操作には `claude` + Bedrock 認証情報が必要で、`AIDLC_TUI_LIVE=1` の後ろにゲートされています。 |

完全なテスト戦略、網羅率レジストリ、テスト追加方法については [テスト](09-testing.md) を参照してください。

## 参照先

- [オーケストレーター](03-orchestrator.md) -- `SKILL.md` の詳細
- [ステージプロトコル](04-stage-protocol.md) -- 振る舞い契約
- [エージェントシステム](05-agent-system.md) -- エージェント構造と設定
- [フックとツール](06-hooks-and-tools.md) -- フック実装
- [ナレッジシステム](10-knowledge-system.md) -- 2 層アーキテクチャ
- [図版集](diagrams.md) -- すべての Mermaid 図を 1 か所に集約

フック用PATHは、WindowsのMachine/User Path、macOSの`getconf PATH`・`/etc/paths`・`/etc/paths.d`、Linuxの`getconf PATH`・`/etc/environment`のPATH・`/etc/login.defs`のENV_PATH・`environment.d`から求めます。worktreeのBolt IDはUnit claimと同じintent UUID末尾を含みます。
