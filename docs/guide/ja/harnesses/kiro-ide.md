# Kiro IDE での AI-DLC 実行

このフレームワークのハーネスの 1 つとして、`dist/kiro-ide/` は [Kiro IDE](https://kiro.dev/) の内部で同じ AI-DLC 方法論を実行します。決定論的な 1 つのコア、つまりツール、33 個のステージファイル、プロトコル、ナレッジ、センサー、スコープ、ルールは、すべてのハーネスでバイト単位に共有されます。異なるのはシェル（スキル、エージェントサーフェス、フックの配線、有効化方法）だけです。

:::important
**Kiro IDE では Claude Opus 4.8 で AI-DLC を実行してください。** コンダクターは各ステージごとに複数段階の手順を進めます。確認質問、成果物の生成、レビュー担当者の確認、学習ループ、そして承認ゲートです。Opus 4.8 はこの手順を最後まで守り、各ゲートで正しく停止します。より弱いモデルは任意手順（レビュー担当者の確認と学習ループ）を省略し、ゲートを急いで通過することがあります。ワークフローを始める前に、チャットモデルを **Claude Opus 4.8** に設定してください。
:::

## 前提条件

- **Kiro IDE** にサインイン済みであること
- **Claude Opus 4.8** がチャットモデルとして選択されていること（上の注記を参照）
- **bun** が `PATH` 上にあること（`curl -fsSL https://bun.sh/install | bash`）

:::tip
bun は *非対話* シェルから見える `PATH` 上になければなりません。IDE がフックやツールを実行するのはそのシェルです。これらのシェルは `~/.zshenv`（zsh）または `~/.bashrc`（bash）を読み取り、`~/.zshrc` は読みません。しかし bun のインストーラーは `~/.zshrc` に書き込みます。ターミナルでは `which bun` が通るのにフックから bun が見つからない場合は、`BUN_INSTALL` / `PATH` の `export` 行を `~/.zshenv`（または `~/.bashrc`）へコピーしてください。
:::

## インストール

以下でコピーする配布物は、[aidlc-workflows](https://github.com/awslabs/aidlc-workflows) リポジトリの clone（`v2` ブランチ）から取得したものです。

```bash
git clone https://github.com/awslabs/aidlc-workflows.git
cd aidlc-workflows
git checkout v2
```

```bash
mkdir -p your-project/.kiro your-project/aidlc
# Safe on fresh installs; required when upgrading from v2.5.56 or earlier.
for retired_hook in \
  audit-logger block mint runtime-compile stop sync-statusline
do
  rm -f \
    "your-project/.kiro/hooks/aidlc-${retired_hook}.json" \
    "your-project/.kiro/hooks/aidlc-${retired_hook}.kiro.hook"
done
rm -f \
  your-project/.kiro/agents/aidlc.json \
  your-project/.kiro/agents/aidlc-*-agent.json \
  your-project/.kiro/settings/cli.json
cp -R dist/kiro-ide/.kiro/. your-project/.kiro/
cp -R dist/kiro-ide/aidlc/. your-project/aidlc/     # the workspace shell (spaces/default/memory) — a sibling of .kiro/, not inside it
cp dist/kiro-ide/AGENTS.md your-project/AGENTS.md   # merge if you already have one
```

1 つ目の削除ループは v2.5.57 のフック名移行のためのものです。2 つ目の削除は、古い IDE 配布物が出荷していた Kiro CLI 形式のエージェント JSON と設定ファイルを取り除きます。オーバーレイコピーでは退役したファイルを削除できません。どちらの削除も新規インストールでは何もしません。このクリーンアップの後、`cp -R <src>/. <dst>/` の形式はツリーの**中身**をコピーします。`your-project/.kiro` が既に存在する場合でも、存在しない場合でも同じように動作します。単純な `cp -r dist/kiro-ide/.kiro your-project/.kiro` は、既存の `.kiro/` の内側に 2 つ目の `.kiro` を入れ子にしてしまい、IDE は新しいファイルを一切認識しません。

`aidlc/` ディレクトリはワークスペースシェルです。エンジンが読む事前構築済みの `aidlc/spaces/default/memory/` メソッドツリーを含みます。これは `.kiro/` の **兄弟ディレクトリ** であり、その内側ではないため、別々にコピーしてください（または `dist/kiro-ide/` ツリー全体をまとめてコピーしても構いません）。これがないと、`/aidlc --doctor` の "workspace shell ready" 判定は失敗します。

`your-project/` を Kiro IDE で開きます。このインストールには次が含まれます。

- `.kiro/skills/aidlc/SKILL.md` - `/aidlc` を呼び出したときに読み込まれるコンダクターです。
- `.kiro/agents/aidlc.md` - IDE のワークスペースエージェントセレクタに現れる、同じコンダクターです。
- `.kiro/agents/aidlc-*-agent.md` - 委譲先ペルソナ全 14 体です。IDE ネイティブの `tools:` 許可と `permissions.rules` を持ちます。IDE 配布物には agent-v1 JSON も `settings/cli.json` も含まれません。
- `.kiro/steering/aidlc-active-memory.md` - 常時取り込みの IDE ステアリングです。そのライブファイル参照が、コンダクターと委譲エージェントの両方のためにアクティブスペースのメモリファイルをプリロードします。
- `.kiro/hooks/aidlc-*.json` - IDE ネイティブの v2 フック形式で登録されるフレームワークフックです。IDE の Agent Hooks パネルに表示されます。（Kiro IDE 1.x は、このハーネスが以前出荷していたレガシーの `.kiro.hook` 形式を実行しなくなりました。それらのビルドでは、レガシーフックは何の表示もなく無効のままになります。）

チャットパネルで `/aidlc --doctor` を実行してセットアップを確認し、その後 `/aidlc <description>` でワークフローを開始します。

## 使い方

Claude Code ハーネスと同一です。`/aidlc <description>` でワークフローを開始し、`/aidlc --status` で現在位置を確認でき、`/aidlc --doctor`、`--stage`、`--phase`、`--depth`、`--test-strategy` もすべて使えます。ステージごとのランナー（`/aidlc-domain-design`）とスコープごとのランナー（`/aidlc-feature`）もインストールされます。初期化コマンドはありません。同梱シェルがワークスペースを足場として用意し、最初の `/aidlc` で AI-DLC が最初のインテントを自動的に作成します。

## Kiro IDE でフックはどう動くか

Kiro IDE は `.kiro/hooks/` 配下の v2 フック JSON ファイル（`{"version":"v1","hooks":[{name,trigger,matcher,action}]}`、トリガーは PascalCase）を通じてフックを登録します（`hooks` ブロックをエージェント JSON の中で読む Kiro CLI とは異なる仕組みです）。各フックはコマンドを実行し、それが共有の `aidlc-kiro-adapter.ts` シムを経由して IDE のフックイベントを、バイト共有のコアフックが期待する形へ正規化します。

Kiro IDE 1.x はフックの文脈を **stdin 上の JSON**（snake_case: `{ session_id, tool_name, tool_input, tool_response }`）として渡します。古い 0.12 ビルドは代わりに camelCase 相当を環境変数 `USER_PROMPT` に設定し、アダプターは両方を受け入れます。捕捉された PostToolUse の書き込み／シェルイベントは、どちらのチャネルでもツール入力が空のままなので、書き込まれたパスは結果テキストから復元する必要があり、監査末尾を参照するフック（`rebuild-stage-graph`、`sync-workflow-state`）は監査証跡を基準に動きます。グラフ再構築の経路はシェル結果とセッション識別情報も保持するため、`intent-create` の成功が呼び出し元のセッションに結び付きます。最新のイベントは厳密な `session_id` を運びますが、レガシーチャネルは SessionStart が保持する合成識別情報を再利用します。同様に最新の Stop はイベント固有の `session_id` を優先し、同時実行中の別チャットが作成後のハンドオフを横取りしてしまうことを防ぎます。レガシーの `agentStop` は保持済みの識別情報にフォールバックします。後期の 1.x ビルドは一部の PreToolUse と委譲入力を埋め、アダプターはそれらのフィールドを保持します。Windows では、決定論的ユーティリティがこれらの継ぎ目を使って IDE のシェル結果トランスポートを回避します。送信されたプロンプトを公開するビルドでは UserPromptSubmit でユーティリティを実行し、1.0.242 のような（プロンプトフィールドが空の）ビルドでは、正確な `execute_pwsh` の PreToolUse コマンドへフォールバックします。ユーティリティはターンごとに 1 回実行され、その UTF-8 テキストは端末のプロトコル / 制御バイトを含めずに中継され、重複するシェル呼び出しは拒否されます。最新のチャットはターンと出力の状態を `session_id` ごとに保存し、セッション識別情報のないコンテキストはレガシー互換の単一バケットを使います。1.0 より前の camelCase ペイロードは `toolArgs.command` を通じて同じフォールバックを取り、生のプロンプトテキストは新しい世代だけの互換形式です。

ペイロード取得は**ペイロード依存のターゲット**（`audit-and-sensors`、`log-subagent`、`rebuild-stage-graph`）、端末コマンドの継ぎ目に加え、最新の `session_id` を得るための `session-start` と `continue-workflow` に限定されています。空でない `USER_PROMPT` は 0.12 ビルド（stdin を開くが何も書かない）で即座に消費され、それ以外の場合、アダプターは 2 秒の broken-channel 上限付きで 1.x の stdin チャネルを読みます。それ以外のすべてのターゲット — 毎 `PreToolUse` で発火する承認フロアを含む — はどちらのチャネルにも触れず、ゼロレイテンシの経路を保ちます。

| フック | トリガー（マッチャー） | 目的 |
|------|-------------------|---------|
| `aidlc-session-start` | `SessionStart` | セッションごとに 1 回、ワークフローの再開コンテキストを注入する（レガシーの 1.0 より前のファイルはプロンプトごとの `promptSubmit` に接続されたまま。その世代にはセッション開始トリガーがない） |
| `aidlc-mint` | `UserPromptSubmit` | プロンプトごとに人間ターンのイベントを記録する（human-presence ゲート） |
| `aidlc-terminal-command` | `UserPromptSubmit` | プロンプトテキストが利用できる場合、ステータス、doctor、ヘルプ、ナビゲーションなどの端末ユーティリティをモデルより先に実行する |
| `aidlc-terminal-command-guard` | `PreToolUse`（`execute_bash\|execute_pwsh\|shell`） | プロンプトが空の IDE バージョン向けのフォールバック。分類されたユーティリティを 1 回だけ実行し、重複する Windows のシェル呼び出しを拒否する |
| `aidlc-continue-workflow` | `Stop` | 転送ループの監査（勧告のみ。IDE では Stop トリガーはブロックできず、強制はコンダクター自身の Stop プロトコルに依存する） |
| `aidlc-block` | `PreToolUse` | 承認ゲートが開いたままで、その後に人間が操作していない間はツール呼び出しを強制ブロックする（human-presence フロア） |
| `aidlc-write-audit-log` | `PostToolUse`（`fs_write\|str_replace\|fs_append`） | 成果物の作成 / 更新を記録し、続けて該当するセンサーを起動する（パスはツール結果から取得） |
| `aidlc-log-subagent` | `PostToolUse`（`^(subagent_.+\|invoke_sub_agent)$`） | 委譲先の識別情報とともに `SUBAGENT_COMPLETED` を記録する。マッチャーは任意の委譲名がアダプターへ届くよう広く取られており、補助的な `subagent_response` シェルはアダプターが落とす |
| `aidlc-rebuild-stage-graph` | `PostToolUse`（`execute_bash`） | 実行時グラフを再コンパイルする（監査末尾を条件に実行） |
| `aidlc-sync-workflow-state` | `PostToolUse`（`execute_bash`） | 監査内の最新 `STAGE_STARTED` から `Current Stage` を前進方向にのみ同期する（IDE は解析可能なタスクペイロードを渡さない） |

`aidlc-session-end` には **v2 の登録がありません**。IDE の `Stop` トリガーは会話の終了時ではなくアシスタントの各ターンの終わりに発火するため、登録すると同一セッション内のプロンプト間に誤った `SESSION_ENDED` が追記されてしまいます。IDE が本物のセッション終了イベントを公開するまではレガシー専用（`agentStop`、1.0 より前のビルド）のままであり、IDE 1.x では `SESSION_ENDED` は記録されません。

フックが発火するたびに、チャットには "Run Command Hook" 行が表示されます。

### フックのデバッグ

フックの挙動が想定どおりでない場合は、デバッグログを有効にすると、各フックがどの判断経路を通ったか（どのゲートを選んだか、どのパスに解決されたか、なぜ終了したか）を `<record>/.aidlc-hooks-health/hook-debug.log` に追記します。これは **既定では無効** で、通常運用ではログは作られず、余分なオーバーヘッドもありません。有効化する方法は 2 つあり、どちらでも構いません。

- **ファイルシステムマーカー（Kiro IDE では最も簡単）:** プロジェクト内で `touch aidlc/.aidlc-hook-debug` を実行します。次にフックが発火した時点で有効になり、IDE の再起動は不要です。無効化するときは `rm aidlc/.aidlc-hook-debug` を実行します。
- **環境変数:** `export AIDLC_HOOK_DEBUG=1`。IDE はフックを非対話シェルで実行するため、それらのシェルが読む場所へ設定してください。`~/.zshenv`（zsh）または `~/.bashrc`（bash）へ `export` 行を追加し、その後 IDE を再起動します。

## Kiro IDE で異なる点

| 項目 | Claude Code | Kiro IDE |
|------|-------------|----------|
| フック登録 | `settings.json` の `hooks` ブロック | `.kiro/hooks/aidlc-*.json` の v2 フックファイル（IDE >= 1.0）+ `.kiro/hooks/aidlc-*.kiro.hook` のレガシーファイル（1.0 より前）。両方を同梱し、二重発火はしない |
| ゲートと質問 | `AskUserQuestion` ウィジェット | 番号付きの文章による選択肢（番号で回答）。`[Answer]:` タグを持つ質問ファイルが正本のまま残る |
| ステータスライン | 現在のステージ + モデル + コンテキスト % | 利用不可。`/aidlc --status` と、各ゲートで表示される進捗行を使う |
| ディスパッチ型ステージ（2.1 pipeline、2.2 subagent、2.4 mob、3.5 subagent） | `Task` ツール | Kiro の `subagent` ツール -> Markdown のペルソナ全 14 体。IDE は各エージェントのフロントマターから `tools:` と `permissions.rules` を読み取る |
| 構築スウォーム | 並列 `Task` フロア、任意の ultracode Workflow | サブエージェントのファンアウトのみ。`AIDLC_USE_SWARM=1` は無効（no-op）と通知される |
| セッション監査イベント | `SESSION_STARTED/RESUMED/ENDED`、`SESSION_COMPACTED` | IDE 1.x では `SESSION_STARTED` のみ（本物のセッション終了トリガーがなく、`SESSION_ENDED` を記録するのは 1.0 より前のビルドのレガシーフックだけ。コンパクション前イベントもない） |
| MCP サーバー | 5 個を同梱（`.mcp.json`: `context7` + 4 つの AWS サーバー） | 同梱なし |

それ以外、つまり状態機械、インテントごとの記録ディレクトリ（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）配下の監査証跡と成果物、学習ループ、センサー、スコープ、深度 / テスト戦略は同一に動作します。なぜなら本当に同一であり、同じツールが `.kiro/tools/` から実行されるからです。

プロジェクトの `aidlc/` ワークスペースはハーネス中立です。プロジェクトをハーネス間で移動すること、または並行して両方を動かすことはサポートされていますが未検証です。進行中のワークフローがある状態で競合するハーネス構成を検出すると、`/aidlc --doctor` が警告します。

## フレームワーク開発者向け

`dist/kiro-ide` は `core/` と `harness/kiro-ide/` から `bun scripts/package.ts kiro-ide` で **生成** されます（コアの複製に対して `{{HARNESS_DIR}}` トークンを `.kiro` に置換し、`rules/` を `steering/` へ改名します）。`bun scripts/package.ts --check` は差分監視であり、CI で実行されます。手書きの Kiro IDE 側ソースは `harness/kiro-ide/` にあり、オーケストレータースキル（`skills/aidlc/`）、常時取り込みのアクティブメモリステアリング（`steering/`）、コンダクターの Markdown（`agents/aidlc.md`）、フックアダプターと v2 フック JSON ファイル（`hooks/`）、オンボーディング用の記入内容を含みます。編集するのはそれら（または `core/`）であり、生成物の `dist/kiro-ide` ではありません。

IDE ハーネスが CLI ハーネス（`harness/kiro/`）と異なるのは 4 点です。コンダクターのサーフェスが `settings/cli.json` で選択されるエージェントではなく `/aidlc` スキルと `agents/aidlc.md` であること、v2 フック JSON ファイルを同梱すること（CLI はエージェント JSON の `hooks` ブロックに依存します）、常設ルールを CLI のエージェントリソースではなく常時取り込みステアリングでプリロードすること、Kiro 共通の投影処理がコアペルソナから Claude 専用の `disallowedTools` キーを取り除くこと、そして IDE のマニフェストがネイティブな `tools:` と `permissions.rules` のフロントマターを追加することです。Kiro IDE は CLI の agent-v1 JSON や `settings/cli.json` のサーフェスを読み込まず、同梱もしません。詳細は [新しいハーネスへの移植](https://github.com/awslabs/aidlc-workflows/blob/v2/docs/harness-engineering/09-porting-to-a-new-harness.md) を参照してください。

## 次のステップ

インストールと有効化が終わったら、方法論自体はどのハーネスでも同じです。次はハーネス中立の章へ進んでください。

- [最初のワークフロー](../02-your-first-workflow.md) - 注釈付きの最初から最後までの実行例
- [フェーズとステージ](../04-phases-and-stages.md) - 5 つのフェーズと 33 のステージ
- [スコープ、深度、テスト戦略](../05-scopes-and-depth.md) - 実行規模の適切な見積もり方
- [用語集](../glossary.md) - すべての用語の定義

他のハーネス: [Codex CLI での AI-DLC](codex-cli.md) · [Cursor での AI-DLC](cursor.md) · [ハーネス一覧](README.md)
