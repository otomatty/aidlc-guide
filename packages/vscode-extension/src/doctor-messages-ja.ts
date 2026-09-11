/**
 * Local translations of the core doctor messages shipped with AI-DLC 2.8.x.
 * Keep templates anchored: captured values are paths, commands, names or counts,
 * never an unknown English explanation. Unknown messages stay available verbatim.
 */
type MessageKind = "label" | "fix";
type TranslationPattern = readonly [RegExp, string];

const labels: Readonly<Record<string, string>> = {
  "Windows uninstall recovery: no pending continuations":
    "Windows のアンインストール復旧: 保留中の後処理はありません",
  "Update: update checks disabled by global config": "更新確認: 共通設定で無効になっています",
  "Update: update cache is invalid": "更新確認: キャッシュが不正です",
  "Update: update cache is absent": "更新確認: キャッシュがありません",
  "Update: update check unavailable while offline": "更新確認: オフラインのため確認できません",
  "Plugins: no AIDLC plugins installed":
    "プラグイン: AI-DLC プラグインはインストールされていません",
  "Plugins: composed state is current": "プラグイン: 構成は最新です",
  "Models: no installed project harness":
    "モデル: プロジェクトに実行環境がインストールされていません",
  "Models: recorded policy is expressible": "モデル: 保存されたポリシーを適用できます",
  "Instruction file: no installed project harness":
    "指示ファイル: プロジェクトに実行環境がインストールされていません",
  "Instruction file: ownership baseline unreadable - conflict":
    "指示ファイル: 管理対象の基準データを読めないため、競合しています",
  "Instruction file: block present, user content preserved; framework-owned file intact":
    "指示ファイル: 管理ブロックとユーザーの記述を保持しています。フレームワーク管理ファイルも正常です",
  "Instruction file: block present, user content preserved":
    "指示ファイル: 管理ブロックとユーザーの記述を保持しています",
  "Instruction file: framework-owned file intact":
    "指示ファイル: フレームワーク管理ファイルは正常です",
  "Runtime hook environment: no installed project harness":
    "フックの実行環境: プロジェクトに実行環境がインストールされていません",
  "Installed runtime: active version marker unavailable":
    "インストール済みランタイム: 使用するバージョンの記録を取得できません",
  "Command pointer is missing or does not select an active version":
    "コマンドの参照先がないか、使用するバージョンを選択していません",
  "Rollback target: none recorded": "ロールバック先: 記録されていません",
  "Project pin registry: no stale registrations":
    "プロジェクトの固定バージョン一覧: 古い登録はありません",
  "Native command trust: host hooks and permission entries select the installed `aidlc` command":
    "ネイティブコマンドの信頼設定: フックと実行許可はインストール済みの `aidlc` コマンドを参照しています",
  "Execution mode: source checkout (no machine runtime expected)":
    "実行モード: ソースから実行しています。マシンへのランタイムのインストールは不要です",
  "Transaction staging: no abandoned directories":
    "一時作業ディレクトリ: 放置されたディレクトリはありません",
  "Transaction recovery: no quarantined directories":
    "処理の復旧: 隔離されたディレクトリはありません",
  "Project runtime stamp is malformed": "プロジェクトのランタイム情報が不正です",
  "Hook contract: settings.json unreadable - cannot verify wired hooks":
    "フック設定: settings.json を読めないため、登録されたフックを確認できません",
  "Hook contract: settings.json wires no aidlc-*.ts hooks":
    "フック設定: settings.json に aidlc-*.ts フックが登録されていません",
  "Hooks enabled (resolved disableAllHooks is not true)":
    "フックは有効です。適用後の disableAllHooks は true ではありません",
  "Claude managed hook policy: allowManagedHooksOnly=true":
    "Claude の管理者フックポリシー: allowManagedHooksOnly=true",
  "agents/aidlc.{json,md} present (conductor wiring)":
    "agents/aidlc.{json,md} の存在確認: 進行役の設定",
  "hook trust: merge the shipped native trust-seed.toml entries into $CODEX_HOME/config.toml or run one TUI trust pass":
    "フックの信頼設定: 同梱の trust-seed.toml の項目を $CODEX_HOME/config.toml に統合するか、TUI で一度信頼を承認してください",
  "hook trust: pre-seed [hooks.state] with `bun scripts/package.ts codex trust --project <dir>` or run one TUI trust pass":
    "フックの信頼設定: `bun scripts/package.ts codex trust --project <dir>` で [hooks.state] を設定するか、TUI で一度信頼を承認してください",
  "~/.copilot/config.json absent (fine for VS Code-only installs; for the CLI, one interactive run records folder trust - hooks silently no-op untrusted)":
    "~/.copilot/config.json がありません。VS Code のみの利用では問題ありません。CLI では対話実行でフォルダーを信頼してください。未承認のフックは実行されません",
  "project folder in ~/.copilot/config.json trustedFolders (CLI hooks silently no-op without it)":
    "プロジェクトフォルダーが ~/.copilot/config.json の trustedFolders に登録されています。未登録の場合、CLI のフックは実行されません",
  "could not parse ~/.copilot/config.json to verify folder trust (CLI hooks silently no-op untrusted)":
    "~/.copilot/config.json を解析できず、フォルダーの信頼設定を確認できません。未承認の場合、CLI のフックは実行されません",
  "headless runs: set GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=1 for `copilot -p` sessions - repo hooks are off by default in prompt mode":
    "非対話実行: `copilot -p` では GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=1 を設定してください。プロンプトモードではリポジトリのフックが既定で無効です",
  "opencode.json or opencode.jsonc present (permissions + method instructions glob)":
    "opencode.json または opencode.jsonc の存在を確認しました。実行許可と手順ファイルの読み込み設定です",
  "AWS_AIDLC_DEFAULT_SCOPE (unset - no project default)":
    "AWS_AIDLC_DEFAULT_SCOPE は未設定です。プロジェクトの既定スコープはありません",
  "Plugin selection flags: harness.json agrees with stage-graph.json":
    "プラグインの選択設定: harness.json と stage-graph.json が一致しています",
  "Enabled stage compile coverage: every enabled stage file is in the full graph":
    "有効なステージのコンパイル状況: すべてのステージファイルがグラフに含まれています",
  "Composed plugin surface: all enabled plugin stages and recorded contributions are present":
    "プラグイン構成: 有効なステージと登録された追加ファイルがすべて存在します",
  "Plugin selection vs active workflows: no stranded dependencies":
    "プラグインと実行中のワークフロー: 利用できない依存関係はありません",
  "Plugin checks: discovery failed": "プラグイン診断: 診断項目を検出できませんでした",
  "Submodules: no .gitmodules at workspace root":
    "サブモジュール: ワークスペースのルートに .gitmodules はありません",
  "Submodules: .gitmodules present but no parseable submodule entries":
    "サブモジュール: .gitmodules はありますが、解析できる登録項目がありません",
  "Hook heartbeat data": "フックの実行記録",
  "Hook heartbeats: not yet fired (first workflow stage will populate)":
    "フックの実行記録: まだ実行されていません。最初のステージで記録されます",
  "Hook drops: none recorded": "フックの処理失敗: 記録はありません",
  "State matches last audit event (no drift)": "状態と最新の監査イベントが一致しています",
  "Runtime locks: none leaked": "実行時ロック: 取り残されたロックはありません",
  "state version readable": "状態ファイルのバージョンの読み取り",
  "state version current": "状態ファイルと最新バージョンの一致",
  "state version compatible": "状態ファイルのバージョンの互換性",
  "Orphan worktrees: 0 observed": "対応のない作業ツリー: 検出されていません",
  "Stale branches: 0 observed (not a git repo)":
    "古いブランチ: 検出されていません。Git リポジトリではありません",
  "Orphan state files: 0 observed": "対応のない状態ファイル: 検出されていません",
  "Orphan audit: 0 observed": "対応のない監査記録: 検出されていません",
  "Practices staleness: state file absent (informational)":
    "開発手順の確認時期: 状態ファイルがありません。参考情報です",
  "Practices staleness: never affirmed (informational)":
    "開発手順の確認時期: まだ確認されていません。参考情報です",
  "Practices staleness: timestamp unreadable": "開発手順の確認時期: 確認日時を読み取れません",
  "Cycle detection: 0 cycles": "循環依存: 検出されていません",
  "Cycle detection: graph load failed": "循環依存: グラフを読み込めませんでした",
  "Uncompiled stage files: 0 stage files missing from the compiled graph":
    "未コンパイルのステージ: グラフに含まれていないファイルはありません",
  "Duplicate producers: every consumed artifact has a single producer":
    "成果物の生成元: 使用される各成果物の生成元は一つです",
  "Keyword overlap: no conflicts": "キーワードの重複: 競合はありません",
  "Rule drift: org rules absent (informational)":
    "ルールの不一致: 組織ルールがありません。参考情報です",
  "Rule drift: no team/project rule overlaps org policy":
    "ルールの不一致: 組織ポリシーと重複するチーム・プロジェクトのルールはありません",
  "Intent registry: all rows match their record dirs":
    "作業一覧: すべての登録と記録ディレクトリが一致しています",
  "Intent registry: reconciliation check failed":
    "作業一覧: 登録とディレクトリの照合に失敗しました",
  "Providers: no installed project harness":
    "プロバイダー: プロジェクトに実行環境がインストールされていません",
  "Providers: recorded answers have no unmet actions":
    "プロバイダー: 保存された設定に未完了の作業はありません",
  "Providers: using shipped fallback; no recorded answers":
    "プロバイダー: 設定の保存がないため、同梱の既定値を使用しています",
  "Providers: could not read recorded answers": "プロバイダー: 保存された設定を読み取れません",
  "Flags: no installed project harness":
    "動作設定: プロジェクトに実行環境がインストールされていません",
  "Flags: recorded answers are active without environment drift":
    "動作設定: 保存された設定が有効です。環境変数との不一致はありません",
  "Flags: no recorded project answers": "動作設定: プロジェクト設定は保存されていません",
  "Flags: could not read recorded answers": "動作設定: 保存された設定を読み取れません",
  "Workspace siblings: no installed project harness":
    "ワークスペースの関連ディレクトリ: プロジェクトに実行環境がインストールされていません",
  "Workspace siblings: complete projection is present":
    "ワークスペースの関連ディレクトリ: 必要なファイルがすべて存在します",
  "Workspace records: not a git repo - nothing to commit":
    "ワークスペースの記録: Git リポジトリではないため、コミット対象はありません",
  "runtime-graph.json is older than its authored stage inputs.":
    "runtime-graph.json が元のステージ定義より古くなっています。",
  "runtime-graph.json is missing for the active workflow.":
    "実行中のワークフローに runtime-graph.json がありません。",
  "No hook heartbeats yet (fresh install or hooks not registered).":
    "フックの実行記録がありません。新規インストール直後か、フックが未登録です。",
  ".aidlc-plan.json is present but not parseable.":
    ".aidlc-plan.json は存在しますが、解析できません。",
  "Stage graph present": "ステージグラフの存在確認",
};

const fixes: Readonly<Record<string, string>> = {
  "finish active AI-DLC commands, then run `aidlc version` to resume cleanup":
    "実行中の AI-DLC コマンドを終了し、`aidlc version` で後処理を再開してください",
  "run `aidlc use <version>` with a complete retained version":
    "保持されている完全なバージョンを指定して `aidlc use <version>` を実行してください",
  "run a pinned command from the moved project to self-heal its registration":
    "移動先のプロジェクトから固定バージョンのコマンドを実行し、登録先を修復してください",
  "finish any active AI-DLC command, then rerun the command to trigger the safe staging sweep":
    "実行中の AI-DLC コマンドを終了してから再実行し、一時作業ディレクトリの安全な清掃を開始してください",
  "inspect each listed directory, recover any needed files, then remove the directory manually":
    "表示された各ディレクトリを確認し、必要なファイルを復旧してから手動で削除してください",
  "Install Bun, then add its install directory to the Windows User or Machine PATH, not only a shell profile.":
    "Bun をインストールし、インストール先を Windows のユーザー環境変数またはシステム環境変数の PATH に追加してください。シェルのプロファイルだけではフックから利用できません。",
  "Install Bun, then add ~/.bun/bin to the login-independent environment used by the harness, not only .zshrc or .bash_profile.":
    "Bun をインストールし、ログインに依存しない実行環境の PATH に ~/.bun/bin を追加してください。.zshrc や .bash_profile だけではフックから利用できません。",
  "Add the aidlc command directory to the Windows User or Machine PATH.":
    "aidlc コマンドのディレクトリを Windows のユーザー環境変数またはシステム環境変数の PATH に追加してください。",
  "Add ~/.local/bin to the login-independent environment used by the harness, not only an interactive shell rc file.":
    "ログインに依存しない実行環境の PATH に ~/.local/bin を追加してください。対話シェルの rc ファイルだけではフックから利用できません。",
  "Install the Cursor CLI and ensure `cursor --version` works; IDE-only installs may omit it.":
    "Cursor CLI をインストールし、`cursor --version` が実行できることを確認してください。IDE のみで利用する場合は不要です。",
  "Kiro IDE has no required separate CLI for this project surface.":
    "このプロジェクトで Kiro IDE を利用する場合、別の CLI は不要です。",
  "repair ~/.copilot/config.json as valid JSONC, then re-run doctor":
    "~/.copilot/config.json を有効な JSONC に修正し、doctor を再実行してください",
  "verify this harness's hook registration or trust configuration, then fully restart the harness before resuming the workflow":
    "実行環境のフック登録と信頼設定を確認し、実行環境を完全に再起動してからワークフローを再開してください",
  "health dir exists and the ledger shows STAGE_STARTED, but no hook has ever fired — verify hooks are registered in settings.json":
    "診断記録ディレクトリと STAGE_STARTED の記録はありますが、フックが一度も実行されていません。settings.json のフック登録を確認してください",
  "health dir exists but heartbeat files are unreadable - verify permissions and hook registration":
    "診断記録ディレクトリはありますが、実行記録を読み取れません。アクセス権とフック登録を確認してください",
  "manually set Status=Completed in aidlc-state.md or restart the workflow":
    "aidlc-state.md の Status=Completed を手動で設定するか、ワークフローを再開してください",
  "run `/aidlc --status` to review and resolve the pending approval":
    "`/aidlc --status` で保留中の承認を確認し、承認または却下してください",
  "inspect the owning checkout and candidate history; release only after a human confirms the attempt is abandoned":
    "担当者の作業ディレクトリと候補コミットの履歴を確認してください。作業の中止を人が確認してから、担当の割り当てを解除してください",
  "confirm the intent was removed or renamed, preserve any candidate commit needed for salvage, then delete the orphan refs manually":
    "作業が削除または改名されたことを確認し、復旧に必要な候補コミットを保存してから、対応のない参照を手動で削除してください",
  "if no in-flight compose gate is actually pending, delete it ('rm aidlc/.aidlc-compose-pending') or resolve the pending gate. A stale marker no longer disables the Stop hook, but it should not linger.":
    "構成計画の承認が保留中でなければ 'rm aidlc/.aidlc-compose-pending' で記録を削除してください。保留中なら承認を解決してください。古い記録は Stop フックを無効にしませんが、残さないでください。",
  "if no background subagent is actually running, delete it ('rm aidlc/.aidlc-subagent-inflight'). Stale or malformed entries never authorize the Stop hook, but the ledger should not linger.":
    "バックグラウンドのサブエージェントが動作していなければ 'rm aidlc/.aidlc-subagent-inflight' で記録を削除してください。古い記録や不正な記録が Stop フックを許可することはありませんが、残さないでください。",
  "Plugin names must be lowercase kebab-case, start with a letter, and must not use the reserved aidlc namespace.":
    "プラグイン名は英字で始まる小文字の kebab-case にし、予約済みの aidlc 名前空間を使わないでください。",
  "review this plugin-provided finding": "プラグインが報告したこの診断結果を確認してください",
  "Verify Amazon Bedrock model access in the recorded region and confirm the AWS principal has bedrock:InvokeModel permission.":
    "設定済みリージョンで Amazon Bedrock のモデルにアクセスできることと、AWS の実行主体に bedrock:InvokeModel 権限があることを確認してください。",
  "Select the intended Amazon Bedrock chat model in the Kiro IDE model picker.":
    "Kiro IDE のモデル選択から、使用する Amazon Bedrock のチャットモデルを選んでください。",
  "Configure GitHub Copilot BYOK provider environment variables for this install.":
    "この環境で利用する GitHub Copilot BYOK のプロバイダー環境変数を設定してください。",
  "Configure the provider in Cursor and select it for the active chat session.":
    "Cursor でプロバイダーを設定し、現在のチャットセッションで選択してください。",
  "Configure the selected non-Bedrock provider in the harness.":
    "選択した Bedrock 以外のプロバイダーを実行環境で設定してください。",
  "The workflow is waiting at an approval gate. Resolve it with `/aidlc` (answer the open question / approve or reject the stage), then continue.":
    "ワークフローは承認待ちです。`/aidlc` で未回答の質問に答えるか、ステージを承認または却下してから続行してください。",
  "Each declared collaborator must write its contribution file with the identity-marker first line before approval. Dispatch the missing collaborator(s) to write their contribution, then re-report.":
    "承認前に、各協力エージェントが識別情報を先頭行に含む担当成果ファイルを書く必要があります。未提出のエージェントに作成を依頼し、再度報告してください。",
  "A state write was lost after the audit event landed. Set Status=Completed in aidlc-state.md, or restart the workflow if the state is otherwise inconsistent.":
    "監査イベントの記録後に状態の保存が失われています。aidlc-state.md に Status=Completed を設定してください。ほかにも状態の不整合がある場合は、ワークフローを再開してください。",
  "If a workflow has run, verify hooks are registered in the harness wiring config.":
    "ワークフローを実行済みの場合は、実行環境の設定にフックが登録されていることを確認してください。",
  "A cold hook silently skips its side effects (audit, sensors, runtime compile). Verify the hook is wired and firing on this harness.":
    "動作していないフックでは、監査・センサー・実行時コンパイルも行われません。この実行環境でフックが登録され、実行されていることを確認してください。",
  "A hook silently half-applied something (a dropped contribution or a failed recompile). Inspect the hook's .drops file, fix the cause, and re-compose.":
    "フックの処理が一部だけ適用されています。担当成果の欠落や再コンパイルの失敗が考えられます。フックの .drops ファイルを確認し、原因を修正して構成計画を作成し直してください。",
  "The resolve output is corrupt. Re-run the resolve step (`/aidlc` will recompute the plan), or remove .aidlc-plan.json to force a fresh resolve.":
    "計画の解決結果が破損しています。`/aidlc` で計画を再計算するか、.aidlc-plan.json を削除して新しく解決し直してください。",
  '"disableAllHooks": true is enforced by enterprise managed settings — the highest-precedence layer, which a project or user setting cannot override. IT policy must remove it (or set it to false) for AI-DLC to run. If policy mandates disabled hooks, AI-DLC v2 is not compatible with this environment — its workflow engine is hook-driven.':
    '企業の管理設定で "disableAllHooks": true が強制されています。優先順位が最も高いため、プロジェクトやユーザーの設定では変更できません。AI-DLC を実行するには管理者がこの設定を削除するか false にする必要があります。AI-DLC v2 はフックで動作するため、フックを禁止する環境では利用できません。',
  "hooks from .claude/settings.json are blocked by organization policy (allowManagedHooksOnly); only the Claude Code administrator can lift it in managed-settings.json. Until then, the workflow's human-presence and summary-confirmation receipts cannot be minted; attended sessions can set AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1 and AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD=1 in the environment that launches the CLI as a temporary bypass":
    ".claude/settings.json のフックが組織ポリシー allowManagedHooksOnly で禁止されています。managed-settings.json で解除できるのは Claude Code の管理者のみです。解除まではユーザーの参加と要約確認を記録できません。人が立ち会うセッションでは、一時対応として CLI 起動環境に AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1 と AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD=1 を設定できます",
  "1. Run /hooks to check hook approval and policy state. 2. If hooks need approval, approve them and fully restart the CLI; approval does not take effect until a full restart. 3. If /hooks says hooks are restricted by policy, only your Claude Code administrator can lift allowManagedHooksOnly in managed-settings.json. Until then, for an attended session, launch the CLI with AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1 and AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD=1":
    "1. /hooks でフックの承認とポリシーを確認してください。2. 承認が必要なら承認後に CLI を完全に再起動してください。再起動まで承認は反映されません。3. ポリシーで制限されている場合、managed-settings.json の allowManagedHooksOnly を解除できるのは Claude Code の管理者のみです。解除までは人が立ち会うセッションで、AIDLC_SKIP_HUMAN_PRESENCE_GUARD=1 と AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD=1 を設定して CLI を起動できます",
};

const labelPatterns: readonly TranslationPattern[] = [
  [
    /^Windows uninstall recovery: (\d+) pending and (\d+) invalid continuation\(s\): (.+)$/,
    "Windows のアンインストール復旧: 保留中 $1 件、不正な後処理 $2 件: $3",
  ],
  [/^Update: binary (\S+), latest (\S+)$/, "更新確認: 使用中 $1、最新 $2"],
  [
    /^Update: binary (\S+); update cache is stale$/,
    "更新確認: 使用中 $1。更新確認のキャッシュが古くなっています",
  ],
  [/^Update: binary (\S+) is latest$/, "更新確認: $1 は最新です"],
  [/^Plugins: (\d+) need attention$/, "プラグイン: $1 件の確認が必要です"],
  [/^Plugins: (\d+) require sync$/, "プラグイン: $1 件の同期が必要です"],
  [/^Models: (\d+) policy issue\(s\)$/, "モデル: ポリシーに $1 件の問題があります"],
  [
    /^Instruction file: hand-modified - conflict \((.+)\)$/,
    "指示ファイル: 手動変更と競合しています: $1",
  ],
  [
    /^Instruction file: block or file missing \((.+)\)$/,
    "指示ファイル: ブロックまたはファイルがありません: $1",
  ],
  [
    /^Runtime hook PATH: (bun|aidlc) -> (.+) \(non-interactive baseline\)$/,
    "フックの PATH: $1 → $2。非対話実行の環境で利用できます",
  ],
  [
    /^Runtime hook PATH: (bun|aidlc) is not required by the selected projection$/,
    "フックの PATH: 選択された実行環境では $1 は不要です",
  ],
  [
    /^Runtime hook PATH: (bun|aidlc) is interactive-only at (.+)$/,
    "フックの PATH: $1 は対話実行でのみ利用できます: $2",
  ],
  [/^Runtime hook PATH: (bun|aidlc) is missing$/, "フックの PATH: $1 が見つかりません"],
  [/^Harness CLI: (\S+) (\S*) at (.+)$/, "実行環境の CLI: $1 $2、場所: $3"],
  [/^Harness CLI: none required for (\S+)$/, "実行環境の CLI: $1 では不要です"],
  [
    /^Harness CLI: (\S+) (\S+) is below (\S+)$/,
    "実行環境の CLI: $1 $2 は必要なバージョン $3 より古いです",
  ],
  [/^Harness CLI: (\S+) is missing$/, "実行環境の CLI: $1 が見つかりません"],
  [
    /^Harness CLI: optional (\S+) is not installed$/,
    "実行環境の CLI: 任意の $1 はインストールされていません",
  ],
  [/^Installed runtime: (\S+) \[([^\]]+)\]$/, "インストール済みランタイム: $1 [$2]"],
  [
    /^Installed runtime (\S+) has no harness installed$/,
    "インストール済みランタイム $1 に実行環境がありません",
  ],
  [/^Command pointer: (.+) -> (\S+)$/, "コマンドの参照先: $1 → $2"],
  [
    /^Command pointer is missing or does not select active version (\S+)$/,
    "コマンドの参照先がないか、使用するバージョン $1 を選択していません",
  ],
  [
    /^Rollback target: (\S+) is complete and eligible$/,
    "ロールバック先: $1 は完全な状態で利用できます",
  ],
  [/^Rollback target is not eligible: (".*")$/, "ロールバック先として利用できません: $1"],
  [
    /^Project pin registry: stale registrations: (.+)$/,
    "プロジェクトの固定バージョン一覧: 古い登録があります: $1",
  ],
  [
    /^Transaction staging: (\d+) abandoned path\(s\): (.+)$/,
    "一時作業ディレクトリ: $1 件が放置されています: $2",
  ],
  [
    /^Transaction recovery: (\d+) quarantined path\(s\): (.+)$/,
    "処理の復旧: $1 件が隔離されています: $2",
  ],
  [/^Project runtime stamp: (\S+) \((\S+)\)$/, "プロジェクトのランタイム情報: $1 ($2)"],
  [
    /^Project runtime stamp: (\S+); selected engine: (\S+)$/,
    "プロジェクトのランタイム情報: $1、選択中のエンジン: $2",
  ],
  [/^Project pin is malformed: (".*")$/, "プロジェクトの固定バージョンが不正です: $1"],
  [/^Project pin: (\S+) is installed$/, "プロジェクトの固定バージョン: $1 はインストール済みです"],
  [
    /^Project pin: (\S+) is not installed completely$/,
    "プロジェクトの固定バージョン: $1 のインストールが不完全です",
  ],
  [
    /^Project pin target: (\S+) resolves before engine startup$/,
    "プロジェクトの固定バージョン: エンジン起動前に $1 を解決できます",
  ],
  [
    /^Hooks DISABLED via "disableAllHooks": true in (.+) — AI-DLC cannot run \(audit, state sync, sensors, and stage-graph rebuild are all silently skipped even though the hook files are present\)$/,
    'フックが $1 の "disableAllHooks": true で無効です。AI-DLC は動作できません。フックのファイルが存在しても、監査・状態同期・センサー・ステージグラフの再構築が実行されません',
  ],
  [
    /^Multi-harness install detected \(([^)]+)\) with an active workflow - supported but untested; keep all trees at the same framework version$/,
    "実行中のワークフローに複数の実行環境があります: $1。対応していますが未検証です。すべて同じフレームワークのバージョンにそろえてください",
  ],
  [/^AWS_AIDLC_DEFAULT_SCOPE=(.+) \(valid\)$/, "AWS_AIDLC_DEFAULT_SCOPE=$1 は有効です"],
  [/^AWS_AIDLC_DEFAULT_SCOPE=(.+) \(invalid\)$/, "AWS_AIDLC_DEFAULT_SCOPE=$1 は無効です"],
  [
    /^Enabled plugins: all enabled \(no selection\); enabled stage counts: ([\w=, -]+)$/,
    "有効なプラグイン: すべて有効です。個別選択はありません。有効なステージ数: $1",
  ],
  [
    /^Enabled plugins: ([\w, -]*); enabled stage counts: ([\w=, -]+)$/,
    "有効なプラグイン: $1。有効なステージ数: $2",
  ],
  [
    /^Plugin selection flags: (\d+) disagreement\(s\)$/,
    "プラグインの選択設定: $1 件の不一致があります",
  ],
  [
    /^Enabled stage compile coverage: (\d+) enabled stage file\(s\) missing from the full graph$/,
    "有効なステージのコンパイル状況: $1 件の有効なステージがグラフにありません",
  ],
  [
    /^Enabled stage compile coverage: (\d+) uncompiled stage file\(s\) - no selection active, see the Uncompiled stage files advisory$/,
    "有効なステージのコンパイル状況: $1 件が未コンパイルです。個別選択はありません。「未コンパイルのステージ」の注意事項を確認してください",
  ],
  [
    /^Composed plugin surface: (\d+) missing composition item\(s\)$/,
    "プラグイン構成: $1 件の構成項目がありません",
  ],
  [
    /^Plugin selection vs active workflows: (\d+) stranded dependency\(ies\)$/,
    "プラグインと実行中のワークフロー: $1 件の依存関係が利用できません",
  ],
  [
    /^Selection-dropped ordering edges \(advisory\): (\d+) requires_stage edge\(s\) point at disabled stages - (.+)$/,
    "プラグイン選択による順序依存の除外: $1 件の requires_stage が無効なステージを参照しています。要確認: $2",
  ],
  [
    /^workspace shell ready \((\.[\w-]+)\/ \+ aidlc\/spaces\/default\/memory\/\)$/,
    "ワークスペースの基本構成: $1/ + aidlc/spaces/default/memory/",
  ],
  [
    /^Agent filename\/name consistency: all agent files match declared names$/,
    "エージェント名: すべてのファイル名が宣言された名前と一致しています",
  ],
  [
    /^Scope filename\/name consistency: all scope files match declared names$/,
    "スコープ名: すべてのファイル名が宣言された名前と一致しています",
  ],
  [
    /^Submodules: (\d+) declared, all initialized$/,
    "サブモジュール: 登録された $1 件はすべて初期化済みです",
  ],
  [
    /^Submodules: (\d+) declared, (\d+) uninitialized \(advisory\) \((.+)\) - run `([^`]+)` to fetch them so reverse-engineering can read the code$/,
    "サブモジュール: 登録 $1 件のうち $2 件が未初期化です: $3。`$4` で取得し、既存コードの分析で読み取れるようにしてください",
  ],
  [
    /^Hooks last fired ([\dTZ:.+ -]+), but the workflow last advanced ([\dTZ:.+ -]+)$/,
    "フックの最終実行は $1 ですが、ワークフローの最終進行は $2 です",
  ],
  [
    /^Hooks have never executed although this workflow has progressed (\d+) stages?$/,
    "ワークフローは $1 ステージ進みましたが、フックは一度も実行されていません",
  ],
  [
    /^Human-turn receipts: 0 HUMAN_TURN rows across (\d+) stage\/gate event\(s\) \(advisory\) - receipts are not being minted, so presence-gated checkpoints will refuse$/,
    "ユーザー参加の記録: $1 件のステージ・承認イベントに HUMAN_TURN がありません。参加記録が必要なチェックポイントを通過できません",
  ],
  [
    /^Hook drops \(([\w.-]+)\): (\d+) degraded of (\d+)$/,
    "フックの処理失敗 ($1): $3 件のうち $2 件が部分的に失敗しています",
  ],
  [
    /^State\/audit drift: audit has WORKFLOW_COMPLETED but state Status=(.+)$/,
    "状態と監査の不一致: 監査には WORKFLOW_COMPLETED がありますが、状態は Status=$1 です",
  ],
  [/^State Version: (\d+)$/, "状態ファイルのバージョン: $1"],
  [
    /^Approval gate pending: (.+) \(~([\dhms ]+)\); waiting for a human, not stuck\. Run \/aidlc --status to review the current gate\.$/,
    "承認待ち: $1。約 $2 経過しています。ユーザーの判断を待っています。/aidlc --status で現在の承認内容を確認してください。",
  ],
  [
    /^Unit claim stamp stale: ([\w.-]+) generation (\d+) is tombstoned or superseded$/,
    "ユニット担当の記録が古くなっています: $1 の世代 $2 は削除済みか、新しい記録で置き換えられています",
  ],
  [
    /^Unit claim activity baseline missing \(advisory\): ([\w., -]+) - run \/aidlc --status after the next explicit fetch to establish a local observed-ref timestamp$/,
    "ユニット担当の活動基準がありません: $1。次の明示的な取得後に /aidlc --status を実行し、参照を確認した日時を記録してください",
  ],
  [
    /^Unit claim activity: (\d+) claim\(s\) with no observed ref movement for (\d+)h \(([^)]+)\) - report only; inspect the team checkout and release only after a human decision$/,
    "ユニット担当の活動: $1 件で $2 時間、参照の変化がありません: $3。診断による報告のみです。チームの作業ディレクトリを確認し、人が判断してから担当を解除してください",
  ],
  [
    /^Orphan Unit claim refs: (\d+) ref\(s\) match no local intent \((.+)\)$/,
    "対応のないユニット担当の参照: $1 件にローカルの作業記録がありません: $2",
  ],
  [
    /^Stale branches: 0 \((\d+) bolt-\* observed\)$/,
    "古いブランチ: 検出されていません。bolt-* を $1 件確認しました",
  ],
  [/^Orphan audit: 0 \((\d+) reconciled\)$/, "対応のない監査記録: ありません。$1 件を照合しました"],
  [
    /^Orphan state files: 0 \((\d+) active\)$/,
    "対応のない状態ファイル: ありません。$1 件が使用中です",
  ],
  [/^Practices staleness: affirmed (\d+) days? ago$/, "開発手順の確認時期: $1 日前に確認済みです"],
  [
    /^Practices staleness: affirmed (\d+) days ago \(advisory: > (\d+) days; consider re-running practices-discovery\)$/,
    "開発手順の確認時期: $1 日前で、$2 日を超えています。practices-discovery での再確認を検討してください",
  ],
  [
    /^Practices staleness: affirmed in the future \(clock skew or hand-edited timestamp (\d+) days? ahead\)$/,
    "開発手順の確認時期: 確認日時が $1 日先になっています。時計のずれか、日時の手動変更が考えられます",
  ],
  [
    /^MERGE_DISPATCH: 0 orphan INVOKED \((\d+) bracketed\)$/,
    "MERGE_DISPATCH: 終了記録のない INVOKED はありません。$1 件の開始と終了を照合しました",
  ],
  [
    /^MERGE_DISPATCH: (\d+) orphan INVOKED \(advisory - a merge started but no matching finish was recorded within (\d+)s\)$/,
    "MERGE_DISPATCH: $1 件の INVOKED に終了記録がありません。マージ開始後 $2 秒以内に対応する終了が記録されていません",
  ],
  [/^Cycle detection: (\d+) cycle\(s\) found$/, "循環依存: $1 件を検出しました"],
  [
    /^Orphan stage files: (\d+) graph entries all have files$/,
    "ステージファイル: グラフの $1 件すべてに対応するファイルがあります",
  ],
  [
    /^Orphan stage files: (\d+) graph entries have no file on disk$/,
    "ステージファイル: グラフの $1 件に対応するファイルがありません",
  ],
  [
    /^Scope validation: (\d+) scopes valid \((\d+) advisories\)$/,
    "スコープ検証: $1 件が有効です。注意事項 $2 件",
  ],
  [
    /^Scope validation: (\d+) of (\d+) scopes have errors$/,
    "スコープ検証: $2 件のうち $1 件にエラーがあります",
  ],
  [
    /^Schema validation: (\d+)\/(\d+) stages validated$/,
    "スキーマ検証: $2 ステージのうち $1 件が正常です",
  ],
  [
    /^Schema validation: (\d+) of (\d+) stage\(s\) failed$/,
    "スキーマ検証: $2 ステージのうち $1 件が失敗しました",
  ],
  [
    /^Graph references: (\d+) artifacts \+ edges resolved$/,
    "グラフの参照: $1 件の成果物と依存関係を解決できました",
  ],
  [/^Graph references: (\d+) broken reference\(s\)$/, "グラフの参照: $1 件の参照先が不正です"],
  [/^Keyword overlap: (\d+) conflict\(s\)$/, "キーワードの重複: $1 件の競合があります"],
  [
    /^Paired sensor coverage: no sensor-bound rules \((\d+) feedforward-only\)$/,
    "ルールとセンサーの対応: センサーを必要とするルールはありません。事前指示のみ $1 件",
  ],
  [
    /^Paired sensor coverage: (\d+)\/(\d+) guardrails paired \((\d+) feedforward-only\)$/,
    "ルールとセンサーの対応: $2 件のうち $1 件が対応済みです。事前指示のみ $3 件",
  ],
  [/^Providers: (\d+) unmet item\(s\)$/, "プロバイダー: $1 件の未完了項目があります"],
  [
    /^Flags: (\d+) environment or surface override\(s\)$/,
    "動作設定: $1 件が環境変数または実行環境の設定で上書きされています",
  ],
  [/^Settings global: (.+) is valid$/, "共通設定: $1 は有効です"],
  [/^Settings project: (.+) is valid$/, "プロジェクト設定: $1 は有効です"],
  [/^Settings local: (.+) is valid$/, "ローカル設定: $1 は有効です"],
  [/^Settings global: (.+) is invalid$/, "共通設定: $1 は不正です"],
  [/^Settings project: (.+) is invalid$/, "プロジェクト設定: $1 は不正です"],
  [/^Settings local: (.+) is invalid$/, "ローカル設定: $1 は不正です"],
  [/^Settings local: (.+) is git-tracked$/, "ローカル設定: $1 が Git の追跡対象になっています"],
  [/^Settings local: (.+) is not git-tracked$/, "ローカル設定: $1 は Git の追跡対象ではありません"],
  [
    /^Workspace siblings: (\d+) required path\(s\) missing$/,
    "ワークスペースの関連ディレクトリ: $1 件の必要なパスがありません",
  ],
  [
    /^Stage "([^"]+)" has an unresolved approval gate\.$/,
    "ステージ「$1」に未解決の承認があります。",
  ],
  [
    /^Ensemble stage "([^"]+)" is missing or has malformed collaborator evidence\.$/,
    "共同作業ステージ「$1」の協力エージェントの成果記録がないか、不正です。",
  ],
  [
    /^Audit recorded WORKFLOW_COMPLETED but state Status=(.+)\.$/,
    "監査には WORKFLOW_COMPLETED がありますが、状態は Status=$1 です。",
  ],
  [
    /^Hook "([\w.-]+)" has not fired in over (\d+)h\.$/,
    "フック「$1」は $2 時間以上実行されていません。",
  ],
  [
    /^Hook "([\w.-]+)" recorded (\d+) degraded drop\(s\)\.$/,
    "フック「$1」で $2 件の部分的な処理失敗を記録しています。",
  ],
  [/^(?:all )?(\d+) checks passed$/, "$1 件の検査が正常です"],
];

const fixPatterns: readonly TranslationPattern[] = [
  [/^(?:run|re-run) `([^`]+)`$/, "`$1` を実行してください"],
  [
    /^run `([^`]+)`, correct the named condition, then rerun `([^`]+)`$/,
    "`$1` を実行し、表示された問題を修正してから `$2` を再実行してください",
  ],
  [
    /^run `([^`]+)` and correct the invalid update setting$/,
    "`$1` を実行し、不正な更新設定を修正してください",
  ],
  [/^refresh the project with `([^`]+)`$/, "`$1` でプロジェクトの設定を更新してください"],
  [
    /^review the local changes, then run `([^`]+)`$/,
    "ローカルの変更内容を確認し、`$1` を実行してください",
  ],
  [
    /^run `([^`]+)` or select the machine release with `([^`]+)`$/,
    "`$1` を実行するか、`$2` でマシンの使用バージョンを選択してください",
  ],
  [
    /^run `([^`]+)` or write one strict semver$/,
    "`$1` を実行するか、厳密なセマンティックバージョンを一つ記載してください",
  ],
  [
    /^run `([^`]+)` to restore (.+) from the installed runtime$/,
    "`$1` を実行し、インストール済みランタイムから $2 を復元してください",
  ],
  [
    /^restore (.+) from git, or re-copy `([^`]+)` from the aidlc-workflows checkout$/,
    "Git から $1 を復元するか、aidlc-workflows の作業ディレクトリから `$2` をコピーし直してください",
  ],
  [
    /^copy the workspace shell from `([^`]+)` into your project root$/,
    "`$1` からワークスペースの基本構成をプロジェクトのルートにコピーしてください",
  ],
  [/^verify file exists in (.+)$/, "$1 にファイルが存在することを確認してください"],
  [/^valid values: ([\w, -]+)$/, "有効な値: $1"],
  [/^missing files: (.+)$/, "不足しているファイル: $1"],
  [/^cycles: ([\w; >-]+)$/, "循環依存の経路: $1"],
  [
    /^Install (Claude Code|Kiro CLI|opencode) and ensure `([^`]+)` works\.$/,
    "$1 をインストールし、`$2` が実行できることを確認してください。",
  ],
  [
    /^Install or upgrade Codex CLI to (\S+) or later\.$/,
    "Codex CLI $1 以降をインストールするか、更新してください。",
  ],
  [
    /^Install @github\/copilot (\S+) or later for CLI use; VS Code-only installs may omit it\.$/,
    "CLI を利用する場合は @github/copilot $1 以降をインストールしてください。VS Code のみで利用する場合は不要です。",
  ],
  [
    /^add "(.+)" to trustedFolders in ~\/\.copilot\/config\.json \(or accept the CLI's interactive trust prompt\)$/,
    '~/.copilot/config.json の trustedFolders に "$1" を追加するか、CLI の対話画面で信頼を承認してください',
  ],
  [
    /^remove "disableAllHooks": true from (.+) \(or set it to false in a higher-precedence layer such as \.claude\/settings\.local\.json\) and restart the Claude Code session — AI-DLC's workflow engine is hook-driven and cannot advance while hooks are disabled\.$/,
    '$1 の "disableAllHooks": true を削除するか、.claude/settings.local.json などの優先する設定で false にし、Claude Code のセッションを再起動してください。AI-DLC はフックで動作するため、フックが無効な間は進行できません。',
  ],
  [
    /^remove (.+) from git tracking and keep its \.gitignore entry$/,
    "$1 を Git の追跡対象から外し、.gitignore の除外設定を維持してください",
  ],
  [/^Expected the script under (.+)\.$/, "スクリプトは $1 以下に配置してください。"],
  [
    /^Replace (.+) with a regular file contained by (.+)\.$/,
    "$1 を $2 以下にある通常のファイルで置き換えてください。",
  ],
  [/^Inspect or replace (.+)\.$/, "$1 を確認するか、置き換えてください。"],
  [/^Verify (.+) can be run with Bun\.$/, "$1 を Bun で実行できることを確認してください。"],
  [
    /^Reduce the number of checks emitted by (.+)\.$/,
    "$1 が出力する診断項目の数を減らしてください。",
  ],
  [
    /^Practices Affirmed Timestamp value "([^"]*)" is not a valid ISO 8601 datetime\. Re-run practices-discovery \(stage 2\.2\) to re-affirm\.$/,
    'Practices Affirmed Timestamp の値 "$1" は有効な ISO 8601 日時ではありません。practices-discovery (ステージ 2.2) で確認し直してください。',
  ],
  [
    /^branches ([\w., -]+) have no worktree directory and no WORKTREE_MERGED\/_DISCARDED audit row\. Delete via 'git branch -D bolt-<slug>' if abandoned\.$/,
    "ブランチ $1 に作業ツリーと WORKTREE_MERGED/_DISCARDED の監査記録がありません。放棄済みなら 'git branch -D bolt-<slug>' で削除してください。",
  ],
  [
    /^state files for ([\w., -]+) exist but slug not in Bolt Refs and no WORKTREE_DISCARDED row\. Recover via 'aidlc-worktree discard --slug <slug>' \(idempotent\)\.$/,
    "$1 の状態ファイルはありますが、Bolt Refs と WORKTREE_DISCARDED の記録がありません。'aidlc-worktree discard --slug <slug>' で復旧してください。再実行しても安全です。",
  ],
  [
    /^the checkout stamp may linger after release; preserve any useful work, then delete (.+) and re-claim explicitly$/,
    "担当解除後の作業ディレクトリに記録が残っている可能性があります。必要な作業内容を保存し、$1 を削除してから明示的に担当を取得し直してください",
  ],
  [
    /^The compiled runtime graph is out of date\. Re-run `([^`]+)`; if this recurs, the rebuild-stage-graph hook may not be firing on this harness \(check hook heartbeats\)\.$/,
    "コンパイル済みの実行時グラフが古くなっています。`$1` を再実行してください。繰り返す場合は rebuild-stage-graph フックが動作していない可能性があるため、フックの実行記録を確認してください。",
  ],
  [
    /^No compiled runtime graph\. Re-run `([^`]+)`\. If it never appears, the rebuild-stage-graph hook is not firing on this harness\.$/,
    "コンパイル済みの実行時グラフがありません。`$1` を再実行してください。生成されない場合、この実行環境で rebuild-stage-graph フックが動作していません。",
  ],
];

const checkNames: Readonly<Record<string, string>> = {
  "Plugin selection": "プラグイン選択",
  "Agent filename/name consistency": "エージェントのファイル名と宣言名の整合性",
  "Scope filename/name consistency": "スコープのファイル名と宣言名の整合性",
  "Orphan worktrees": "対応のない作業ツリー",
  "Stale branches": "古いブランチ",
  "Orphan state files": "対応のない状態ファイル",
  "Orphan audit": "対応のない監査記録",
  "Orphan stage files": "ステージファイル",
  "Scope validation": "スコープ検証",
  "Schema validation": "スキーマ検証",
  "Graph references": "グラフの参照",
  "Duplicate producers": "成果物の生成元の重複",
  "Keyword overlap": "キーワードの重複",
  "Rule drift": "ルールの不一致",
  "Paired sensor coverage": "ルールとセンサーの対応",
};

const filePurposes: Readonly<Record<string, string>> = {
  "hook shim": "フックのアダプター",
  "hook wiring": "フックの登録",
  "workspace default-agent activation": "ワークスペースの既定エージェント",
  "model/provider/sandbox config": "モデル・プロバイダー・サンドボックスの設定",
  "permission prefix rules": "コマンド接頭辞の実行許可",
  "/aidlc entry point": "/aidlc の開始点",
  "persona custom agents": "役割別のカスタムエージェント",
  "onboarding + method imports": "導入案内と手順ファイルの読み込み",
  "Shell(bun) permission pre-approval": "Shell(bun) の事前実行許可",
  "standing method rule (alwaysApply read instruction)": "常時適用する手順ルールの読み込み指示",
  "Ideation phase rule (agent-decided read instruction)":
    "構想フェーズのルール。エージェントの判断で読み込みます",
  "Inception phase rule (agent-decided read instruction)":
    "計画フェーズのルール。エージェントの判断で読み込みます",
  "Construction phase rule (agent-decided read instruction)":
    "構築フェーズのルール。エージェントの判断で読み込みます",
  "Operation phase rule (agent-decided read instruction)":
    "運用フェーズのルール。エージェントの判断で読み込みます",
};

function translateOne(value: string, kind: MessageKind): string | null {
  const exact = (kind === "label" ? labels : fixes)[value];
  if (typeof exact === "string") return exact;
  for (const [pattern, translated] of kind === "label" ? labelPatterns : fixPatterns) {
    if (pattern.test(value)) return value.replace(pattern, translated);
  }
  if (kind === "label") {
    const failedName = /^(.*): check failed$/.exec(value)?.[1];
    if (failedName && Object.hasOwn(checkNames, failedName))
      return `${checkNames[failedName]}: 検査に失敗しました`;
    const drift =
      /^(Orphan worktrees|Stale branches|Orphan state files|Orphan audit): (\d+) drift$/.exec(
        value,
      );
    if (drift?.[1]) return `${checkNames[drift[1]]}: ${drift[2]} 件の不一致があります`;
    const file = /^([\w./\\-]+\.(?:ts|json|toml|rules|md|mdc)) present(?: \((.*)\))?$/.exec(value);
    if (file && (!file[2] || Object.hasOwn(filePurposes, file[2]))) {
      return `${file[1]} の存在確認${file[2] ? `: ${filePurposes[file[2]]}` : ""}`;
    }
    // Verbose plugin details contain identifiers and status tokens, not prose.
    const plugin =
      /^(Plugins: (?:\d+ need attention|\d+ require sync|composed state is current)) - ([\w.-]+:[\w-]+(?:, [\w.-]+:[\w-]+)*)$/.exec(
        value,
      );
    if (plugin?.[1]) {
      const translated = translateOne(plugin[1], kind);
      if (translated) return `${translated}: ${plugin[2]}`;
    }
  }
  return null;
}

/** Return null when any part is unknown so the UI can explicitly show the original. */
export function translateDoctorText(value: string, kind: MessageKind): string | null {
  // Findings have one identifier prefix. Do not recurse through arbitrary nested
  // prefixes supplied by plugins or future, unsupported output formats.
  if (kind === "label") {
    const finding = /^(\[[\w.-]+\]) (.+)$/.exec(value);
    if (finding?.[2]) {
      const translated = translateOne(finding[2], kind);
      return translated === null ? null : `${finding[1]} ${translated}`;
    }
  }
  const direct = translateOne(value, kind);
  if (direct !== null) return direct;
  // The CLI joins independently authored remedies with semicolons and may wrap
  // them onto several lines. Only translate the whole value if every part is known.
  if (kind === "fix" && /\r?\n|; /.test(value)) {
    const parts = value.split(/(\r?\n|; )/);
    const translated: string[] = [];
    for (const [index, source] of parts.entries()) {
      if (index % 2 === 1 || source === "") {
        translated.push(source);
        continue;
      }
      const part = translateOne(source, kind);
      if (part === null) return null;
      translated.push(part);
    }
    return translated.join("");
  }
  return null;
}
