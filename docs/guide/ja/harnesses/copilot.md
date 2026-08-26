# GitHub Copilot (CLI + VS Code) での AI-DLC

`dist/copilot/` は、このフレームワークが出荷するハーネス配布物の 1 つであり、**GitHub Copilot** 向けです。1 回のインストールで Copilot の両方のサーフェス、すなわちスタンドアロンの Copilot CLI（`copilot`）と VS Code のエージェントモードの両方をカバーします。GitHub はプロジェクトの発見パス（`.github/skills/`、`.github/agents/`、`.github/hooks/`、ルートの `AGENTS.md`）を両サーフェスで統一したため、このフレームワークは両方が読み取る 1 つのツリーを出荷します。1 つの決定論的なコアを複数のハーネスへ展開します。エンジン、状態機械、監査ログ、グラフ、スウォーム審判、学習用ゲートはどの配布物でもバイト単位で同一であり、異なるのはシェルだけです。このツリーは `core/` と `harness/copilot/` から `bun scripts/package.ts copilot` で **生成** されます。手作業で編集してはいけません（差分監視により CI が失敗します）。

## レイアウト: エンジンディレクトリと .github シェル

- **`.aidlc/`** - AIDLC エンジンツリー（tools、hooks + Copilot アダプター、agents、knowledge、scopes、sensors、aidlc-common）。どちらの Copilot サーフェスもここをスキャンしません。ユーザーに見えるものはすべて `.github/` に乗ります。
- **`.github/`** - ネイティブに消費される、`aidlc` という名前が付いた出力のみです: フック配線（`hooks/aidlc.json`）、14 のペルソナカスタムエージェント（`agents/aidlc-*-agent.md`）、そしてスキルツリー全体（`skills/aidlc*/` - オーケストレーター、ステージごとのランナー、スコープランナー、セッションスキル）。リポジトリ自身の `.github/` の内容（workflows、templates）には手を付けません。インストールはこれらのファイルを MERGE（統合）します。すべて接頭辞によって衝突しません。

## 前提条件

- **Copilot CLI ≥ 1.0.74 かつ/または VS Code ≥ 1.130** - PascalCase でのフック登録（両サーフェスとも同一の snake_case ペイロードを配信するようになります）、ブロッキングの PreToolUse deny チャネル、ブロッキングの Stop フック、そして `.github` の skills/agents 発見について検証済みのラインです。`copilot --version` / `code --version` で確認してください。（VS Code のエージェントフックは Preview 機能です - doctor がこの下限を固定します。）
- **bun** - 他のすべてのハーネスと同じ要件です。すべてのツールとフックは bun 経由で実行されるため、Copilot が起動するシェルの PATH 上に bun が存在している必要があります。
- **フォルダー信頼** - リポジトリのフックは、プロジェクトの絶対パスが `~/.copilot/config.json` の `trustedFolders` に含まれている場合にのみ実行されます（CLI は初回の対話利用時にプロンプトを表示します）。ヘッドレスの `copilot -p` 実行では、さらに `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=1` が必要です。**未信頼の場合、すべてのフックは警告なしに黙って no-op になります** - `/aidlc --doctor` が両方をチェックするサーフェスです。
- **モデルプロバイダー** - このインストールはモデルを何も固定しません。サインイン済みの Copilot はそのまま動作します。BYOK も GitHub 認証なしで動作します（例: Amazon Bedrock の Anthropic 互換エンドポイント: `COPILOT_PROVIDER_BASE_URL=https://bedrock-runtime.<region>.amazonaws.com/anthropic`、`COPILOT_PROVIDER_TYPE=anthropic`、ベアラートークン、そして `COPILOT_MODEL=<catalog name>` + `COPILOT_PROVIDER_WIRE_MODEL=<Bedrock model id>` - この組み合わせは `copilot help providers` に記載されています）。VS Code では、モデルピッカーまたはカスタムエンドポイントプロバイダーを使用してください。

## インストール

以下でコピーする内容は、[aidlc-workflows](https://github.com/awslabs/aidlc-workflows) リポジトリの `v2` ブランチをクローンしたものに含まれています。

```bash
git clone https://github.com/awslabs/aidlc-workflows.git
cd aidlc-workflows
git checkout v2
```

1. 配布物をプロジェクトへコピーします。

   ```bash
   mkdir -p your-project/.aidlc your-project/aidlc your-project/.github
   cp -R dist/copilot/.aidlc/.  your-project/.aidlc/
   cp -R dist/copilot/aidlc/.   your-project/aidlc/    # the workspace shell — a sibling of .aidlc/, not inside it
   cp -R dist/copilot/.github/. your-project/.github/  # MERGE — everything is aidlc-prefixed, nothing of yours is overwritten
   cp dist/copilot/AGENTS.md    your-project/AGENTS.md # or merge into yours — keep the @-import block (the method include)
   ```

2. ワークフローを始める前に、同梱 `AGENTS.md` の「Git Integration」節にある `.gitignore` 設定を適用してください（クローンごとの監査シャードは意図的にコミットされます。カーソルとマシン固有の実行時状態は無視したままにします）。

3. フォルダーを信頼します。プロジェクト内で `copilot` を対話的に一度起動し、信頼プロンプトを承諾してください（または `~/.copilot/config.json` の `trustedFolders` にプロジェクトの絶対パスを追加してください）。

4. `/aidlc --doctor` を実行し、続けて `/aidlc` に作りたいものを続けて実行してください - どちらのサーフェスでも同様です。

## このハーネスでの差分

- **1 つのインストールで 2 つのサーフェス。** スキル、ペルソナ、instructions、フックは CLI と VS Code のエージェントモードで同一に動作します。以下の差分は明示的に記載します。
- **質問は番号付き文章の選択肢として表示されます。** 両サーフェスともネイティブのピッカーツールを備えていますが、ピッカーの回答はツール結果として返されるため、人間プレゼンスガードが要求する信頼済みの `UserPromptSubmit` イベントを発火しません。セッションで選択中のワークフローが有効な `Status: Running` 状態にあるあいだは、マッチャーなしの PreToolUse ガードがそれらのピッカー呼び出しを拒否し、番号付き文章を表示してターンを終えるようモデルに指示します。実行中のワークフローがない場合（完了済みや利用不能な状態を含む）は、ネイティブピッカーには手を触れません。人間の次のチャットメッセージはこのイベントを発火します。`[Answer]:` タグ付きの質問 FILE が引き続き信頼できる情報源です。
- **フックはネイティブに強制されます。** アダプター（`.aidlc/hooks/aidlc-copilot-adapter.ts`、`.github/hooks/aidlc.json` により配線）は、コアガードのブロックを Copilot の `permissionDecision: deny` に変換します - レビュアーの読み取りスコープ境界とステート遷移ガードは実際にツール呼び出しを拒否します。SessionStart と Stop のレスポンスは、CLI のトップレベルフィールドと VS Code が要求する `hookSpecificOutput` エンベロープの両方を含みます。CLI 上では実機検証済みです。VS Code のエージェントモードでも同じ deny/block チャネルが文書化されており、アダプターは `runTerminalCommand`、`createFile`、`editFiles`、`readFile` といった文書化された名前を正規化しますが、IDE 側はまだ実機検証されていません - 検証されるまでは IDE 側の強制はベストエフォートとして扱ってください。
- **コマンド追跡は厳密かつベストエフォートです。** AI-DLC は、単純で直接的なオーケストレーター呼び出し、ソースディスパッチャー呼び出し、そして実際にコンパイルされた `next`・`continue`・`report`・`park` コマンドを追跡します。末尾の `2>&1` は 1 つだけサポートされます。検査系のコマンドを `aidlc` という部分文字列から分類することはありません。曖昧なラッパーや、引数に有効なシェル展開（`$VAR`、グロブ、ブレース展開、先頭の `~`）を含むコマンドは、そのまま追跡なしで実行されます。シェルが最終的に生成する argv をフックがハッシュ化できないためです。直接呼び出しに見える複合コマンドは拒否されます。現在の物理プロジェクトの外を指す明示的な `--project-dir` は、現在プロジェクトの調整情報が書き込まれる前に拒否されます。
- **継続のリプレイは、どのハーネスでもエンジンが所有します。** Copilot は Claude、Codex、Cursor、Kiro、Kiro IDE、opencode と同じ、レコードローカルでアトミックな単回使用カーソルを使います。まずネイティブトークンの検証が走り、その後エンジンがトークンの SHA-256 全体を比較し、アクティブディレクティブのロックの下で標準出力より先に正確な後継を公開します。Copilot のセッション所有権と配信証跡はそのマーカーを補強しますが、リプレイを所有するわけではありません。欠落・不正形式・v1・共有前の各マーカーは、同一トランザクション内で 1 回だけ復旧されます。新しい `next` はカーソルをリセットします。クラッシュ、移行、ロールバック、ファイルシステムの制限については、開発者リファレンスの共有カーソル契約を参照してください。
- **Stop は配信済みの現在の Copilot 指示を保持します。** ホストの正確な `tool_use_id`、または書き換えられたエンジン入力を通じて運ばれ PostToolUse が返すアダプター ID によって、セッション単位の Stop / Resume 動作のための配信を確定できます。正確な相関が得られない場合、実行は追跡なしで許可され、Post は推測しません。新しい単純な `next` が追跡付きの配信を復元します。相関の喪失が恒久的な拒否になることはありません。クレーム（所有権主張）が一度試みられた後は、プロジェクト・状態・セッションの所有権による拒否は明示的な deny です。別のセッションが、所有者の現在トークンを追跡外の作業として実行することはできません。
- **旧来の Resume と会話待ちはセッション単位です。** Stop は、本物の会話的な応答が正常に終了することを許可します。2.6.19 より前のインストールが書いた Resume マーカーは所有者スコープのまま残ります。明示的な `next --resume` がそれに優先し、そのまま続行します。プロンプト本文とルールの内容は、調整マーカーには永続化されません。
- **ホスト側の検証証跡は意図的に範囲を絞っています。** 書き換えと引き継ぎ ID のエコーは、macOS 上の Copilot CLI 1.0.79 の非対話モードで実機検証済みです。VS Code の `tool_use_id`、`updatedInput`、`tool_response` の経路は、文書化された Preview 契約に基づいてカバーされていますが、ここでは実機検証されていません。Copilot クラウドエージェントは、本リリースがサポートする AI-DLC の対象外です。
- **フック配線は設計上マッチャーを使いません**: VS Code はフックマッチャーを解析はしますが無視するため、代わりにすべてのアダプターターゲットが `tool_name` で自己フィルタリングします - マッチャーを使うと IDE 上では気づかないうちに範囲が広がってしまいます。
- **レビュアーの識別情報は配信されるのではなく相関によって求められます**: PreToolUse のペイロードには呼び出しごとのエージェントフィールドがありません。アダプターは SubagentStart/SubagentStop（VS Code の `agent_type`/`agent_id` フィールドを含む）で委譲を挟み込み、稼働中のサブエージェントがちょうど 1 つのときにその識別情報を転送します。重複が曖昧な場合、その呼び出しは fail open します（レビュアーモジュールの文章による境界が引き続き適用されます）。
- **ペルソナに `model:` の固定はありません。** 2 つのサーフェスはモデル値の構文で一致しません（CLI は frontmatter の文字列をそのまま BYOK プロバイダーへ転送しますが、IDE の表示名をそこに渡すと 400 エラーになります）。エージェントはセッションのモデルを継承します - このハーネスでのティア投影は、種別によってモデル省略になります。
- **ワーカーペルソナは明示的な組み込み `tools:` 許可リストを使います。** Copilot の `agent` 委譲ツールを除外することで、入れ子の委譲を禁止しています。Copilot には「agent 以外すべて」という形式が無いため、委譲されたワーカーは任意の MCP ツールを継承しません。
- **AIDLC プラグインは Copilot ネイティブのサーフェスを使います。** 合成されたプラグインペルソナと生成されたステージ/スコープランナーは `.github/{agents,skills}` に置かれます。プラグイン選択はこれらのパスを再生成するだけで、`.aidlc/skills` や `.opencode/agents` を作成することは決してありません。
- **セッション終了**: VS Code は SessionEnd を文書化していないため、共有のフックマニフェストは両方のホストでこれを省略します。アダプターは、次回の SessionStart で推論された provenance（来歴）を用いて前回セッションを整合させます（codex と同じパターンです）。
- **メソッドのインクルードは AGENTS.md の `@`-import に乗ります**（CLI 上では実機検証済みです。VS Code も `@`-import の展開を文書化していますが、そちらではまだ実機検証されていません）。`/aidlc space <name>` はそのブロックをその場で付け替え、`.github/agents/` のペルソナの対も含めて更新します。
- **ステータスラインはありません**。`/aidlc --status` とゲートでの進捗行を使ってください。
- **構築スウォームはサブエージェントのファンアウトのみです**（`AIDLC_USE_SWARM=1` は明示的な no-op です）。
- **MCP**: 何も同梱されません。サーバーを追加する場合、この点でサーフェスが分岐することに注意してください - CLI は `~/.copilot/mcp-config.json` を読み、VS Code は `.vscode/mcp.json` を読みます。指揮者はこれらを利用できますが、委譲されたワーカーペルソナは利用できません。

## 検証

```bash
cd your-project
copilot -p "/aidlc --doctor" -s --allow-all-tools   # or run /aidlc --doctor in VS Code chat
```

doctor は、エンジンツリーとすべてのアダプター依存関係、ルートの `AGENTS.md`、`.github` の配線ファイル、CLI のバージョン下限、フォルダー信頼をチェックし、ヘッドレス用の環境変数についても注意喚起します。このハーネス向けの決定論的なエンジンテストは `tests/unit/t248-copilot-packaging.test.ts`、`t249-copilot-adapter.test.ts`、`t250-copilot-adapter-security.test.ts` です。実機での動作確認は `tests/e2e/t-exec-copilot-status.serial.test.ts` で、`AIDLC_COPILOT_EXEC_LIVE=1` で有効化されます。
