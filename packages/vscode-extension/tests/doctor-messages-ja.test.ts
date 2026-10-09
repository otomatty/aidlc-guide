import { describe, expect, it } from "vitest";
import { translateDoctorText } from "../src/doctor-messages-ja.ts";

describe("translateDoctorText", () => {
  it("translates v2.9.0 provider and copy-channel remedies without dropping commands", () => {
    expect(
      translateDoctorText("Providers: harness-managed model access; no answer needed", "label"),
    ).toContain("回答は不要");
    for (const remedy of [
      "Install Bun, then add its install directory to the Windows User or Machine PATH, not only a shell profile.",
      "Install Bun, then add ~/.bun/bin to the login-independent environment used by the harness, not only .zshrc or .bash_profile.",
    ]) {
      expect(
        translateDoctorText(
          "This project is a copy-channel projection, so its hooks run through Bun; a native install runs them through the aidlc command instead. " +
            remedy,
          "fix",
        ),
      ).toContain("手動コピー");
    }
    for (const command of [
      "aidlc config --harness cursor",
      "bun .cursor/tools/aidlc.ts config --harness cursor --from <the runtime/cursor/ root you copied from, or a checkout's dist/cursor/ tree>",
    ]) {
      expect(
        translateDoctorText(
          `run \`${command}\` in the project root to recreate the harness tree and workspace shell`,
          "fix",
        ),
      ).toContain(command);
      expect(
        translateDoctorText(
          `Run ${command} to restore the complete cursor projection, including sibling directories.`,
          "fix",
        ),
      ).toContain(command);
    }
    expect(
      translateDoctorText(
        "This project is a copy-channel projection, so its hooks run through Bun; a native install runs them through the aidlc command instead. Unknown future remedy.",
        "fix",
      ),
    ).toBeNull();
  });
  it.each([
    ["budget-entries", "directory entries", "ディレクトリ内の項目数", "250000", "件"],
    ["budget-directories", "directories", "ディレクトリ数", "100000", "件"],
    ["budget-symlinks", "symlinks", "シンボリックリンク数", "100000", "件"],
    ["budget-files", "files", "ファイル数", "250000", "件"],
    ["budget-bytes", "bytes of source", "ソースの容量", "4294967296", "バイト"],
  ])(
    "translates the %s source limit with its path and count",
    (code, unit, label, count, suffix) => {
      expect(
        translateDoctorText(
          `Workspace source boundary binds: no (${code} at packages/生成物: more than ${count} ${unit})`,
          "label",
        ),
      ).toBe(
        `ワークスペースのソース識別: packages/生成物 で${label}が上限 ${count} ${suffix}を超えています`,
      );
    },
  );

  it("translates missing source failure reasons and known symlink failures", () => {
    expect(
      translateDoctorText("Workspace source boundary binds: no (no reason was recorded)", "label"),
    ).toBe("ワークスペースのソース識別: 失敗しました。理由の記録はありません");
    expect(
      translateDoctorText(
        "Workspace source boundary binds: no (symlink-loop at src/shared: the symlink loops or its chain cannot be read)",
        "label",
      ),
    ).toBe(
      "ワークスペースのソース識別: src/shared のシンボリックリンクが循環しているか、参照先を読み取れません",
    );
  });

  it.each([
    [
      "dangling-symlink at src/shared: a registered source path resolves through a symlink whose target is missing",
      "登録済みのソースパス src/shared が経由するシンボリックリンクの参照先がありません",
    ],
    [
      "external-symlink at service-a/src/shared: a registered source path leaves the project through a symlink and comes back inside it",
      "登録済みのソースパス service-a/src/shared は、シンボリックリンクでプロジェクト外を経由して内部に戻ります",
    ],
    [
      "excluded-path at .git/hooks: a registered source path resolves into the framework shell or a hard-excluded directory",
      "登録済みのソースパスの実体 .git/hooks は、フレームワークのシェルまたは必ず除外されるディレクトリの配下にあります",
    ],
  ])("explains a known source boundary failure: %s", (failure, explanation) => {
    expect(translateDoctorText(`Workspace source boundary binds: no (${failure})`, "label")).toBe(
      `ワークスペースのソース識別: ${explanation}`,
    );
  });

  it("marks OS/parser details as original text and preserves punctuation and Windows paths", () => {
    const detail = "EACCES: permission denied, scandir 'C:\\Users\\開発者\\My Project (copy)'";
    expect(
      translateDoctorText(
        `Workspace source boundary binds: no (unreadable at service-a/src: the directory could not be listed: ${detail})`,
        "label",
      ),
    ).toBe(
      `ワークスペースのソース識別: service-a/src のディレクトリの一覧を取得できません。詳細（原文）: ${detail}`,
    );
    const parserDetail = 'Unexpected token "}", invalid JSON (line 2)';
    expect(
      translateDoctorText(
        `Workspace source boundary binds: no (registered-sources-invalid at .aidlc-source-paths.json: .aidlc-source-paths.json could not be parsed: ${parserDetail})`,
        "label",
      ),
    ).toBe(
      `ワークスペースのソース識別: .aidlc-source-paths.json の .aidlc-source-paths.json を解析できません。詳細（原文）: ${parserDetail}`,
    );
  });

  it("preserves the JSON-quoted invalid registered path", () => {
    const registered = JSON.stringify('../日本語\\"file.ts');
    expect(
      translateDoctorText(
        `Workspace source boundary binds: no (registered-sources-invalid at .aidlc-source-paths.json: registered source path ${registered} must be a relative path inside the project without "." or ".." segments)`,
        "label",
      ),
    ).toBe(
      `ワークスペースのソース識別: .aidlc-source-paths.json に登録したソースパス ${registered} は、"." や ".." を含まないプロジェクト内の相対パスにしてください`,
    );
  });
  it.each([
    [
      "Windows uninstall recovery: no pending continuations",
      "Windows のアンインストール復旧: 保留中の後処理はありません",
    ],
    [
      "Plugins: no AIDLC plugins installed",
      "プラグイン: AI-DLC プラグインはインストールされていません",
    ],
    ["Models: recorded policy is expressible", "モデル: 保存されたポリシーを適用できます"],
    [
      "Agent filename/name consistency: all agent files match declared names",
      "エージェント名: すべてのファイル名が宣言された名前と一致しています",
    ],
    ["Update: update cache is absent", "更新確認: キャッシュがありません"],
    ["Update: binary 2.8.0, latest 2.8.1", "更新確認: 使用中 2.8.0、最新 2.8.1"],
    ["Update: binary 2.8.1 is latest", "更新確認: 2.8.1 は最新です"],
    ["Plugins: 1 require sync - host:outdated", "プラグイン: 1 件の同期が必要です: host:outdated"],
    [
      "Plugins: 2 need attention - sample-one:conflict, host:current",
      "プラグイン: 2 件の確認が必要です: sample-one:conflict, host:current",
    ],
    ["Models: 2 policy issue(s)", "モデル: ポリシーに 2 件の問題があります"],
    [
      "Harness CLI: optional cursor is not installed",
      "実行環境の CLI: 任意の cursor はインストールされていません",
    ],
    [
      "Harness CLI: codex 0.144.0 is below 0.145.0",
      "実行環境の CLI: codex 0.144.0 は必要なバージョン 0.145.0 より古いです",
    ],
    ["Providers: 2 unmet item(s)", "プロバイダー: 2 件の未完了項目があります"],
    [
      "Scope validation: 12 scopes valid (47 advisories)",
      "スコープ検証: 12 件が有効です。注意事項 47 件",
    ],
    [
      "Schema validation: 33/33 stages validated",
      "スキーマ検証: 33 ステージのうち 33 件が正常です",
    ],
    [
      "Schema validation: 2 of 33 stage(s) failed",
      "スキーマ検証: 33 ステージのうち 2 件が失敗しました",
    ],
    [
      "Orphan stage files: 2 graph entries have no file on disk",
      "ステージファイル: グラフの 2 件に対応するファイルがありません",
    ],
    ["Stale branches: 3 drift", "古いブランチ: 3 件の不一致があります"],
    ["Orphan worktrees: check failed", "対応のない作業ツリー: 検査に失敗しました"],
    ["Rule drift: check failed", "ルールの不一致: 検査に失敗しました"],
    [
      "Paired sensor coverage: 2/3 guardrails paired (4 feedforward-only)",
      "ルールとセンサーの対応: 3 件のうち 2 件が対応済みです。事前指示のみ 4 件",
    ],
    ["Practices staleness: affirmed 1 day ago", "開発手順の確認時期: 1 日前に確認済みです"],
    [
      "Practices staleness: affirmed 35 days ago (advisory: > 30 days; consider re-running practices-discovery)",
      "開発手順の確認時期: 35 日前で、30 日を超えています。practices-discovery での再確認を検討してください",
    ],
    [
      'Hook "aidlc-state-sync" has not fired in over 4h.',
      "フック「aidlc-state-sync」は 4 時間以上実行されていません。",
    ],
    [
      "[state-audit-drift] Audit recorded WORKFLOW_COMPLETED but state Status=In Progress.",
      "[state-audit-drift] 監査には WORKFLOW_COMPLETED がありますが、状態は Status=In Progress です。",
    ],
    [
      '[gate-unresolved] Stage "stage-123abcd" has an unresolved approval gate.',
      "[gate-unresolved] ステージ「stage-123abcd」に未解決の承認があります。",
    ],
    [
      "runtime-graph.json is older than its authored stage inputs.",
      "runtime-graph.json が元のステージ定義より古くなっています。",
    ],
  ])("translates a core diagnostic: %s", (source, expected) => {
    expect(translateDoctorText(source, "label")).toBe(expected);
  });

  it("preserves Windows paths, Japanese filenames and version values", () => {
    const path = "C:\\Users\\開発者\\My Project\\aidlc.settings.json";
    expect(translateDoctorText(`Settings project: ${path} is invalid`, "label")).toBe(
      `プロジェクト設定: ${path} は不正です`,
    );
    expect(
      translateDoctorText(
        `Windows uninstall recovery: 2 pending and 1 invalid continuation(s): ${path}`,
        "label",
      ),
    ).toBe(`Windows のアンインストール復旧: 保留中 2 件、不正な後処理 1 件: ${path}`);
    const bin = "C:\\Users\\開発者\\.bun\\bin\\bun.exe";
    expect(
      translateDoctorText(`Runtime hook PATH: bun -> ${bin} (non-interactive baseline)`, "label"),
    ).toBe(`フックの PATH: bun → ${bin}。非対話実行の環境で利用できます`);
    expect(
      translateDoctorText("Project runtime stamp: 2.8.0; selected engine: 2.8.1", "label"),
    ).toBe("プロジェクトのランタイム情報: 2.8.0、選択中のエンジン: 2.8.1");
  });

  it("uses a neutral file-check label for both passing and failing checks", () => {
    expect(translateDoctorText("settings.json present", "label")).toBe("settings.json の存在確認");
    expect(translateDoctorText("hooks.json present (hook wiring)", "label")).toBe(
      "hooks.json の存在確認: フックの登録",
    );
    expect(
      translateDoctorText(
        "rules/aidlc-phase-ideation.mdc present (Ideation phase rule (agent-decided read instruction))",
        "label",
      ),
    ).toBe(
      "rules/aidlc-phase-ideation.mdc の存在確認: 構想フェーズのルール。エージェントの判断で読み込みます",
    );
  });

  it.each([
    ["run `aidlc config`", "`aidlc config` を実行してください"],
    [
      "run `aidlc config --unpin` or write one release version id",
      "`aidlc config --unpin` を実行するか、リリースのバージョン ID を一つ記載してください",
    ],
    [
      "run `aidlc config --unpin` or write one strict semver",
      "`aidlc config --unpin` を実行するか、厳密なセマンティックバージョンを一つ記載してください",
    ],
    [
      "run `bun .claude/tools/aidlc.ts doctor --verbose`, correct the named condition, then rerun `bun .claude/tools/aidlc.ts doctor`",
      "`bun .claude/tools/aidlc.ts doctor --verbose` を実行し、表示された問題を修正してから `bun .claude/tools/aidlc.ts doctor` を再実行してください",
    ],
    [
      "run `aidlc config --force` to restore .claude/settings.json from the installed runtime",
      "`aidlc config --force` を実行し、インストール済みランタイムから .claude/settings.json を復元してください",
    ],
    [
      "restore .claude/settings.json from git, or re-copy `dist/claude/.claude/settings.json` from the aidlc-workflows checkout",
      "Git から .claude/settings.json を復元するか、aidlc-workflows の作業ディレクトリから `dist/claude/.claude/settings.json` をコピーし直してください",
    ],
    [
      "Configure the provider in Cursor and select it for the active chat session.",
      "Cursor でプロバイダーを設定し、現在のチャットセッションで選択してください。",
    ],
    [
      "The workflow is waiting at an approval gate. Resolve it with `/aidlc` (answer the open question / approve or reject the stage), then continue.",
      "ワークフローは承認待ちです。`/aidlc` で未回答の質問に答えるか、ステージを承認または却下してから続行してください。",
    ],
    [
      "No compiled runtime graph. Re-run `aidlc engine graph compile`. If it never appears, the rebuild-stage-graph hook is not firing on this harness.",
      "コンパイル済みの実行時グラフがありません。`aidlc engine graph compile` を再実行してください。生成されない場合、この実行環境で rebuild-stage-graph フックが動作していません。",
    ],
    [
      "A state write was lost after the audit event landed. Set Status=Completed in aidlc-state.md, or restart the workflow if the state is otherwise inconsistent.",
      "監査イベントの記録後に状態の保存が失われています。aidlc-state.md に Status=Completed を設定してください。ほかにも状態の不整合がある場合は、ワークフローを再開してください。",
    ],
  ])("translates a remedy without changing commands: %s", (source, expected) => {
    expect(translateDoctorText(source, "fix")).toBe(expected);
  });

  it("preserves punctuation and metacharacters inside a command", () => {
    const command = 'bun "C:\\My Project\\診断.ts" --path "$HOME" --literal $(value)';
    expect(translateDoctorText(`run \`${command}\``, "fix")).toBe(
      `\`${command}\` を実行してください`,
    );
  });

  it("translates complete multiline and joined remedies only when every part is known", () => {
    const first = "run `aidlc config`";
    const second = "run `aidlc doctor`";
    expect(translateDoctorText(`${first}\n${second}`, "fix")).toBe(
      "`aidlc config` を実行してください\n`aidlc doctor` を実行してください",
    );
    expect(translateDoctorText(`${first}\r\n\r\n${second}`, "fix")).toBe(
      "`aidlc config` を実行してください\r\n\r\n`aidlc doctor` を実行してください",
    );
    expect(translateDoctorText(`${first}; ${second}`, "fix")).toBe(
      "`aidlc config` を実行してください; `aidlc doctor` を実行してください",
    );
    expect(translateDoctorText(`${first}\nPlugin's unknown follow-up action`, "fix")).toBeNull();
    expect(translateDoctorText(`${first}; Plugin's unknown follow-up action`, "fix")).toBeNull();
  });

  it.each([
    "Custom plugin: database credentials have expired",
    "Workspace source boundary binds: 4eae264319b7 plus an unknown explanation",
    "Workspace source boundary binds: no (budget-files at src: a future failure explanation)",
    "Workspace source boundary binds: no (future-code at src: unexpected detail)",
    "Workspace source boundary binds: no (unreadable at src: a future failure explanation)",
    "Workspace source boundary binds: no (dangling-symlink at src: a future failure explanation)",
    "Workspace source boundary binds: no (registered-sources-invalid at src: a future failure explanation)",
    "Models: 1 policy issue(s) - cursor: a future policy issue",
    "Update: some future update failure",
    "Plugins: 1 require sync - plugin:ready plus a new English explanation",
    "settings.json present (a future configuration purpose)",
    "settings.json present (constructor)",
    "constructor: check failed",
    "Plugin-specific check: check failed",
    "[custom-plugin] Unknown plugin report",
    '[custom-plugin] [gate-unresolved] Stage "stage-a" has an unresolved approval gate.',
    "Stage graph present but malformed",
    'Hook "aidlc-check" has not fired in over 4h. Additional unknown explanation.',
    "__proto__",
    "",
  ])("keeps unknown text available for an explicit original-text fallback: %s", (source) => {
    expect(translateDoctorText(source, "label")).toBeNull();
  });

  it("does not confuse labels with remedies", () => {
    expect(translateDoctorText("Models: recorded policy is expressible", "fix")).toBeNull();
    expect(translateDoctorText("run `aidlc config`", "label")).toBeNull();
    expect(translateDoctorText("Unknown new remedy", "fix")).toBeNull();
  });

  it("keeps authored policy prose untranslated instead of claiming a prefix translation is complete", () => {
    expect(
      translateDoctorText(
        'Rule drift: 1 team/project rule(s) overlap org policy (review for contradiction): aidlc/spaces/default/memory/team.md ## Way of Working <-> org "We use **trunk-based development**."',
        "label",
      ),
    ).toBeNull();
    expect(
      translateDoctorText("Workspace records: not a git repo - nothing to commit", "label"),
    ).toBe("ワークスペースの記録: Git リポジトリではないため、コミット対象はありません");
  });

  it("translates every v2.11.0 diagnostic, including rows the captures do not reach", () => {
    const labels: [string, string][] = [
      ["AIDLC hooks have not run in this project yet", "まだ一度も実行されていません"],
      ["AI-DLC files: not checked, no record of what AI-DLC wrote", "確認していません"],
      ["Plugins: none in this project", "このプロジェクトにはありません"],
      ["Hooks last fired: record-human-turn 2026-10-09T04:21:35Z", "record-human-turn 2026-10-09T04:21:35Z"],
      [
        "Multi-harness install detected (.claude + .cursor, all on 2.11.0) with an active workflow - supported but untested; keep all trees at the same framework version",
        ".claude + .cursor（すべて 2.11.0）",
      ],
      [
        "Harness trees on different releases: Claude Code (.claude) 2.11.0, Cursor (.cursor) 2.10.0 (the project is pinned to 2.11.0) - a workflow can behave differently depending on which tool runs it",
        "Claude Code (.claude) 2.11.0, Cursor (.cursor) 2.10.0（プロジェクトの固定バージョンは 2.11.0）",
      ],
      [
        "Runtime hook PATH: bun is on this shell's PATH (/home/me/.bun/bin/bun) but not on the system-wide PATH",
        "/home/me/.bun/bin/bun",
      ],
      [
        "Windows uninstall recovery: 1 pending, 0 failed, and 2 invalid continuation(s)",
        "保留中 1 件、失敗 0 件、不正な後処理 2 件",
      ],
      [
        "Update: You're on 2.12.0, newer than the latest stable 2.11.0. To go back to stable 2.11.0: aidlc update --channel stable. To keep getting previews: aidlc config --channel preview.",
        "aidlc config --channel preview",
      ],
      ["Flags: 1 check switched off", "1 件の検査"],
      ["Flags: 3 checks switched off", "3 件の検査"],
      [
        "AI-DLC files: 2 changed in this project, so `aidlc config` keeps them and stops (.claude/x.md, .claude/y.md)",
        "`aidlc config`",
      ],
      [
        "[stage-state-audit-drift] aidlc-state.md shows code-generation as not started, but the audit log shows it completed.",
        "[stage-state-audit-drift] aidlc-state.md では code-generation が未着手",
      ],
      [
        "[current-stage-not-started] aidlc-state.md names build-and-test as the current stage but shows it as not started.",
        "build-and-test が現在のステージ",
      ],
      ["Session model: claude-opus-4.7, from your personal Kiro settings", "claude-opus-4.7"],
    ];
    for (const [source, expected] of labels) {
      const translated = translateDoctorText(source, "label");
      expect(translated, source).not.toBeNull();
      expect(translated, source).toContain(expected);
    }
    const fixes: [string, string][] = [
      [
        "add --verbose to see the details, correct the named condition, then run doctor again",
        "--verbose",
      ],
      [
        'Set "disableAllHooks": false in this project\'s .claude/settings.local.json; it works in the same chat.',
        '"disableAllHooks": false',
      ],
      [
        "This is expected before your first Codex chat in this folder. If you already started one, type /hooks in Codex, press t to trust all, then press Esc, and run doctor again.",
        "/hooks",
      ],
      [
        "This is expected before your first opencode chat in this folder. If you already started one, quit opencode and start it again with just `opencode` in /work/日本語 project, then run doctor again.",
        "/work/日本語 project",
      ],
      [
        "run `bun .claude/tools/aidlc.ts engine orchestrate next` as its own command; it hands the current step out again, and an approval that still matches is kept",
        "`bun .claude/tools/aidlc.ts engine orchestrate next`",
      ],
      [
        "The resolve output is corrupt. Re-run the resolve step (`$aidlc` will recompute the plan), or remove .aidlc-engine/plan.json to force a fresh resolve.",
        "`$aidlc`",
      ],
      [
        "AI-DLC in this project runs on Bun (the installed aidlc command does not need it). Install Bun, then add ~/.bun/bin to the PATH Claude Code starts with (a file in /etc/paths.d), not only .zshrc or .bash_profile.",
        "Claude Code の起動時の PATH（a file in /etc/paths.d）",
      ],
      [
        "The workflow refuses to finish build-and-test while it shows as not started. If build-and-test is the stage you are working on, edit aidlc-state.md: change `- [ ] build-and-test` to `- [-] build-and-test`. Otherwise set Current Stage to the stage the workflow is actually on.",
        "change `- [ ] build-and-test` to `- [-] build-and-test`",
      ],
    ];
    for (const [source, expected] of fixes) {
      const translated = translateDoctorText(source, "fix");
      expect(translated, source).not.toBeNull();
      expect(translated, source).toContain(expected);
    }
  });
});

