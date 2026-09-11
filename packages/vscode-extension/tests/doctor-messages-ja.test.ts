import { describe, expect, it } from "vitest";
import { translateDoctorText } from "../src/doctor-messages-ja.ts";

describe("translateDoctorText", () => {
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
});
